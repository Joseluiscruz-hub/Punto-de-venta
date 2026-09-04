import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { database } from '../database.js';
import { audit, HttpError, parse, resolveStoreContext } from '../http.js';
import {
  saleSchema,
  roundMoney,
  assertCanOperateShift,
  assertSaleReplayScope,
  saleDetails,
  type ProductRow,
  type ShiftRow,
  type SaleRow,
} from './coreHelpers.js';

export function registerSalesRoutes(app: FastifyInstance) {
  app.post('/sales', async (request, reply) => {
    const input = parse(saleSchema, request.body);
    const sale = await database.transaction(async (client) => {
      const context = await resolveStoreContext(request, client);
      if (input.externalId) {
        const duplicate = await client.query(
          'SELECT * FROM sales WHERE tenant_id = $1 AND external_id = $2',
          [request.user.tenantId, input.externalId],
        );
        if (duplicate.rows[0]) {
          assertSaleReplayScope(request, context, duplicate.rows[0] as SaleRow);
          return saleDetails(client, duplicate.rows[0] as SaleRow);
        }
      }

      const shiftResult = await client.query(
        "SELECT * FROM shifts WHERE tenant_id = $1 AND register_id = $2 AND status = 'OPEN' FOR UPDATE",
        [request.user.tenantId, context.registerId],
      );
      const shift = shiftResult.rows[0] as ShiftRow | undefined;
      if (!shift)
        throw new HttpError(409, 'Debes abrir un turno antes de vender', 'SHIFT_REQUIRED');
      assertCanOperateShift(request, shift);

      const qtyById: Record<string, number> = {};
      for (const item of input.items) {
        qtyById[item.id] = (qtyById[item.id] ?? 0) + item.quantity;
      }
      const requestedItems = Object.entries(qtyById).map(([id, quantity]) => ({ id, quantity }));
      const lines: { product: ProductRow; quantity: number }[] = [];
      for (const requested of requestedItems) {
        const product = await client.query(
          `SELECT p.id, p.tenant_id, p.barcode, p.name, p.category, p.image_url, p.cost, p.price,
                  i.stock::integer, i.min_stock::integer
           FROM products p JOIN inventory i ON i.product_id = p.id AND i.store_id = $3
           WHERE p.id = $1 AND p.tenant_id = $2 AND p.active = true FOR UPDATE`,
          [requested.id, request.user.tenantId, context.storeId],
        );
        const row = product.rows[0] as ProductRow | undefined;
        if (!row)
          throw new HttpError(
            404,
            'Uno de los productos ya no esta disponible',
            'PRODUCT_NOT_FOUND',
          );
        if (requested.quantity > row.stock)
          throw new HttpError(409, `Stock insuficiente para ${row.name}`, 'INSUFFICIENT_STOCK');
        lines.push({ product: row, quantity: requested.quantity });
      }

      if (input.clientId) {
        const customer = await client.query(
          'SELECT id FROM customers WHERE id = $1 AND tenant_id = $2 AND active = true',
          [input.clientId, request.user.tenantId],
        );
        if (customer.rowCount === 0)
          throw new HttpError(404, 'Cliente no encontrado', 'CUSTOMER_NOT_FOUND');
      }

      const total = roundMoney(
        lines.reduce((sum, line) => sum + Number(line.product.price) * line.quantity, 0),
      );
      if (input.paymentMethod === 'CASH' && total > input.amountTendered) {
        throw new HttpError(400, 'El efectivo recibido es menor al total', 'INSUFFICIENT_PAYMENT');
      }
      if (
        input.paymentMethod === 'MIXED' &&
        (!(input.amountTendered > 0) || input.amountTendered > total || input.amountTendered === total)
      ) {
        throw new HttpError(
          400,
          'El pago mixto requiere una parte en efectivo menor al total',
          'INVALID_MIXED_PAYMENT',
        );
      }
      const cashPortion =
        input.paymentMethod === 'CASH'
          ? total
          : input.paymentMethod === 'MIXED'
            ? roundMoney(input.amountTendered)
            : 0;
      const electronicPortion = roundMoney(total - cashPortion);
      const change = input.paymentMethod === 'CASH' ? roundMoney(input.amountTendered - total) : 0;
      const saleId = randomUUID();
      const inserted = await client.query(
        `INSERT INTO sales
          (id, external_id, tenant_id, store_id, register_id, shift_id, cashier_id, customer_id,
           datetime, total, payment_method, amount_tendered, change_amount, items_count)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, COALESCE($9::timestamptz, now()), $10, $11, $12, $13, $14)
         ON CONFLICT (tenant_id, external_id) WHERE external_id IS NOT NULL DO NOTHING
         RETURNING *`,
        [
          saleId,
          input.externalId ?? null,
          request.user.tenantId,
          context.storeId,
          context.registerId,
          shift.id,
          request.user.sub,
          input.clientId ?? null,
          input.offlineDate ?? null,
          total,
          input.paymentMethod,
          input.amountTendered,
          change,
          lines.reduce((sum, line) => sum + line.quantity, 0),
        ],
      );
      if (!inserted.rows[0]) {
        const existing = await client.query(
          'SELECT * FROM sales WHERE tenant_id = $1 AND external_id = $2',
          [request.user.tenantId, input.externalId],
        );
        if (!existing.rows[0]) {
          throw new HttpError(409, 'No se pudo confirmar la venta', 'IDEMPOTENCY_CONFLICT');
        }
        assertSaleReplayScope(request, context, existing.rows[0] as SaleRow);
        return saleDetails(client, existing.rows[0] as SaleRow);
      }

      for (const line of lines) {
        const subtotal = roundMoney(Number(line.product.price) * line.quantity);
        await client.query(
          `INSERT INTO sale_items
            (id, sale_id, product_id, product_name, quantity, price, cost, subtotal)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            randomUUID(),
            saleId,
            line.product.id,
            line.product.name,
            line.quantity,
            line.product.price,
            line.product.cost,
            subtotal,
          ],
        );
        await client.query(
          `UPDATE inventory SET stock = stock - $3, updated_at = now()
           WHERE store_id = $1 AND product_id = $2`,
          [context.storeId, line.product.id, line.quantity],
        );
        await client.query(
          `INSERT INTO stock_movements
            (id, tenant_id, store_id, product_id, user_id, sale_id, type, quantity, date, reason)
           VALUES ($1, $2, $3, $4, $5, $6, 'SALE', $7, COALESCE($8::timestamptz, now()), $9)`,
          [
            randomUUID(),
            request.user.tenantId,
            context.storeId,
            line.product.id,
            request.user.sub,
            saleId,
            -line.quantity,
            input.offlineDate ?? null,
            `Venta ${saleId}`,
          ],
        );
      }

      if (input.clientId) {
        await client.query(
          `UPDATE customers SET points = points + $3, total_spent = total_spent + $4,
             last_visit = COALESCE($5::timestamptz, now()), updated_at = now()
           WHERE id = $1 AND tenant_id = $2`,
          [
            input.clientId,
            request.user.tenantId,
            Math.floor(total * 0.01),
            total,
            input.offlineDate ?? null,
          ],
        );
      }

      if (cashPortion > 0) {
        await client.query(
          'UPDATE shifts SET sales_cash = sales_cash + $2, expected_cash = expected_cash + $2 WHERE id = $1',
          [shift.id, cashPortion],
        );
      }
      if (electronicPortion > 0) {
        await client.query('UPDATE shifts SET sales_card = sales_card + $2 WHERE id = $1', [
          shift.id,
          electronicPortion,
        ]);
      }
      await audit(client, request, 'SALE_CREATED', 'sale', saleId, {
        total,
        paymentMethod: input.paymentMethod,
      });
      return saleDetails(client, inserted.rows[0] as SaleRow);
    });
    return reply.status(201).send(sale);
  });
}
