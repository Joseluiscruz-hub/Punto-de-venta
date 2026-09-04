import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { database } from '../database.js';
import { audit, HttpError, parse, resolveStoreContext } from '../http.js';
import {
  uuid,
  returnSaleSchema,
  money,
  roundMoney,
  assertCanOperateShift,
  saleDetails,
  type ShiftRow,
  type SaleRow,
  type SaleItemRow,
  type SaleReturnRow,
  type SaleReturnItemRow,
} from './coreHelpers.js';

export function registerSaleReturnRoute(app: FastifyInstance) {
  app.post('/sales/:id/return', async (request, reply) => {
    const { id: saleId } = parse(z.object({ id: uuid }), request.params);
    const input = parse(returnSaleSchema, request.body);
    const result = await database.transaction(async (client) => {
      const context = await resolveStoreContext(request, client);
      const saleResult = await client.query(
        `SELECT * FROM sales
         WHERE id = $1 AND tenant_id = $2 AND store_id = $3
         FOR UPDATE`,
        [saleId, request.user.tenantId, context.storeId],
      );
      const sale = saleResult.rows[0] as SaleRow | undefined;
      if (!sale) throw new HttpError(404, 'Venta no encontrada', 'SALE_NOT_FOUND');

      const shiftResult = await client.query(
        `SELECT * FROM shifts
         WHERE tenant_id = $1 AND register_id = $2 AND status = 'OPEN'
         FOR UPDATE`,
        [request.user.tenantId, context.registerId],
      );
      const shift = shiftResult.rows[0] as ShiftRow | undefined;
      if (!shift) {
        throw new HttpError(
          409,
          'Debes abrir un turno antes de registrar una devolucion',
          'SHIFT_REQUIRED',
        );
      }
      assertCanOperateShift(request, shift);
      if (input.refundMethod === 'STORE_CREDIT' && !sale.customer_id) {
        throw new HttpError(
          409,
          'La venta debe tener un cliente para generar saldo a favor',
          'CUSTOMER_REQUIRED_FOR_CREDIT',
        );
      }

      const seen = new Set();
      const lines: { item: SaleItemRow; quantity: number }[] = [];
      for (const requested of input.items) {
        if (seen.has(requested.saleItemId)) {
          throw new HttpError(
            400,
            'Hay articulos repetidos en la devolucion',
            'DUPLICATE_RETURN_ITEM',
          );
        }
        seen.add(requested.saleItemId);
        const itemResult = await client.query(
          `SELECT si.*,
                  COALESCE((SELECT SUM(sri.quantity) FROM sale_return_items sri
                            WHERE sri.sale_item_id = si.id), 0)::integer AS returned_quantity
           FROM sale_items si
           WHERE si.id = $1 AND si.sale_id = $2`,
          [requested.saleItemId, sale.id],
        );
        const item = itemResult.rows[0] as (SaleItemRow & { returned_quantity?: number }) | undefined;
        if (!item) {
          throw new HttpError(
            400,
            'Uno de los articulos no pertenece a la venta',
            'INVALID_RETURN_ITEM',
          );
        }
        const availableQuantity = item.quantity - (item.returned_quantity ?? 0);
        if (requested.quantity > availableQuantity) {
          throw new HttpError(
            409,
            `Solo quedan ${availableQuantity} unidades disponibles para devolver de ${item.product_name}`,
            'RETURN_QUANTITY_EXCEEDED',
          );
        }
        lines.push({ item, quantity: requested.quantity });
      }

      const total = roundMoney(
        lines.reduce((sum, line) => sum + Number(line.item.price) * line.quantity, 0),
      );
      const previousReturnSummary = await client.query(
        'SELECT COALESCE(SUM(total), 0) AS returned_total FROM sale_returns WHERE sale_id = $1',
        [sale.id],
      );
      const prevRow = previousReturnSummary.rows[0] as { returned_total: string | number } | undefined;
      const previousReturnedTotal = money(prevRow?.returned_total ?? 0) ?? 0;
      const pointsToReverse =
        Math.floor((previousReturnedTotal + total) * 0.01) -
        Math.floor(previousReturnedTotal * 0.01);
      if (input.refundMethod === 'CASH' && total > (money(shift.expected_cash) ?? 0)) {
        throw new HttpError(
          409,
          'El efectivo esperado del turno no cubre el reembolso',
          'INSUFFICIENT_SHIFT_CASH',
        );
      }

      const returnId = randomUUID();
      const insertedReturn = await client.query(
        `INSERT INTO sale_returns
          (id, tenant_id, store_id, sale_id, shift_id, user_id, refund_method, total, reason)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [
          returnId,
          request.user.tenantId,
          context.storeId,
          sale.id,
          shift.id,
          request.user.sub,
          input.refundMethod,
          total,
          input.reason,
        ],
      );

      const returnedItems: SaleReturnItemRow[] = [];
      for (const line of lines) {
        const subtotal = roundMoney(Number(line.item.price) * line.quantity);
        const returnItem = await client.query(
          `INSERT INTO sale_return_items
            (id, return_id, sale_item_id, product_id, quantity, price, subtotal)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING *, $8::text AS product_name`,
          [
            randomUUID(),
            returnId,
            line.item.id,
            line.item.product_id,
            line.quantity,
            line.item.price,
            subtotal,
            line.item.product_name,
          ],
        );
        returnedItems.push(returnItem.rows[0] as SaleReturnItemRow);
        await client.query(
          `UPDATE inventory SET stock = stock + $3, updated_at = now()
           WHERE store_id = $1 AND product_id = $2`,
          [context.storeId, line.item.product_id, line.quantity],
        );
        await client.query(
          `INSERT INTO stock_movements
            (id, tenant_id, store_id, product_id, user_id, sale_id, type, quantity, reason)
           VALUES ($1, $2, $3, $4, $5, $6, 'RETURN', $7, $8)`,
          [
            randomUUID(),
            request.user.tenantId,
            context.storeId,
            line.item.product_id,
            request.user.sub,
            sale.id,
            line.quantity,
            `Devolucion ${returnId}: ${input.reason}`,
          ],
        );
      }

      if (input.refundMethod === 'CASH') {
        await client.query(
          `UPDATE shifts
           SET expected_cash = expected_cash - $2, refunds_cash = refunds_cash + $2
           WHERE id = $1`,
          [shift.id, total],
        );
      }

      if (sale.customer_id) {
        await client.query(
          `UPDATE customers
           SET total_spent = GREATEST(0, total_spent - $3),
               points = GREATEST(0, points - $4),
               store_credit = store_credit + $5,
               updated_at = now()
           WHERE id = $1 AND tenant_id = $2`,
          [
            sale.customer_id,
            request.user.tenantId,
            total,
            pointsToReverse,
            input.refundMethod === 'STORE_CREDIT' ? total : 0,
          ],
        );
      }

      await audit(client, request, 'SALE_RETURNED', 'sale_return', returnId, {
        saleId: sale.id,
        total,
        refundMethod: input.refundMethod,
        items: lines.length,
      });

      const row = insertedReturn.rows[0] as SaleReturnRow;
      return {
        sale: await saleDetails(client, sale),
        saleReturn: {
          id: row.id,
          tenantId: row.tenant_id,
          storeId: row.store_id,
          saleId: row.sale_id,
          shiftId: row.shift_id,
          userId: row.user_id,
          refundMethod: row.refund_method,
          total: money(row.total) ?? 0,
          reason: row.reason,
          createdAt: row.created_at,
          items: returnedItems.map((item) => ({
            id: item.id,
            returnId: item.return_id,
            saleItemId: item.sale_item_id,
            productId: item.product_id,
            name: item.product_name,
            quantity: item.quantity,
            price: money(item.price) ?? 0,
            subtotal: money(item.subtotal) ?? 0,
          })),
        },
      };
    });
    return reply.status(201).send(result);
  });

}
