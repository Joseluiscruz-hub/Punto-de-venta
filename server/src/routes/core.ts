import { randomUUID } from 'node:crypto';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { database, type QueryClient } from '../database.js';
import { audit, authenticate, authorize, HttpError, parse, resolveStoreContext } from '../http.js';

const uuid = z.string().uuid();
const productSchema = z.object({
  barcode: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(200),
  category: z.string().trim().min(1).max(100),
  cost: z.coerce.number().min(0).max(99_999_999),
  price: z.coerce.number().min(0).max(99_999_999),
  stock: z.coerce.number().int().min(0).max(99_999_999),
  minStock: z.coerce.number().int().min(0).max(99_999_999),
});
const customerSchema = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().email().max(200).optional().or(z.literal('')),
  phone: z.string().trim().max(30).optional(),
  taxId: z.string().trim().max(30).optional(),
});
const saleSchema = z.object({
  externalId: z.string().trim().min(1).max(100).optional(),
  items: z.array(z.object({ id: uuid, quantity: z.coerce.number().int().positive() })).min(1).max(200),
  paymentMethod: z.enum(['CASH', 'CARD', 'TRANSFER', 'MIXED']),
  amountTendered: z.coerce.number().min(0).max(99_999_999),
  clientId: uuid.optional(),
  offlineDate: z.string().datetime().optional(),
});

interface ProductRow {
  id: string;
  tenant_id: string;
  barcode: string;
  name: string;
  category: string;
  cost: string | number;
  price: string | number;
  stock: number;
  min_stock: number;
}

interface CustomerRow {
  id: string;
  tenant_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  tax_id: string | null;
  points: number;
  total_spent: string | number;
  last_visit: string | null;
}

interface ShiftRow {
  id: string;
  tenant_id: string;
  store_id: string;
  register_id: string;
  user_id: string;
  start_time: string;
  end_time: string | null;
  initial_cash: string | number;
  expected_cash: string | number;
  actual_cash: string | number | null;
  difference: string | number | null;
  status: 'OPEN' | 'CLOSED';
  sales_cash: string | number;
  sales_card: string | number;
  cash_out: string | number;
}

interface SaleRow {
  id: string;
  external_id: string | null;
  tenant_id: string;
  store_id: string;
  register_id: string;
  shift_id: string | null;
  cashier_id: string;
  customer_id: string | null;
  datetime: string;
  total: string | number;
  payment_method: 'CASH' | 'CARD' | 'TRANSFER' | 'MIXED';
  amount_tendered: string | number;
  change_amount: string | number;
  items_count: number;
}

interface SaleItemRow {
  id: string;
  sale_id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  price: string | number;
  cost: string | number;
  subtotal: string | number;
}

const money = (value: string | number | null) => value === null ? undefined : Number(value);
const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

function mapProduct(row: ProductRow) {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    barcode: row.barcode,
    name: row.name,
    category: row.category,
    cost: money(row.cost) ?? 0,
    price: money(row.price) ?? 0,
    stock: row.stock,
    minStock: row.min_stock,
  };
}

function mapCustomer(row: CustomerRow) {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    email: row.email ?? undefined,
    phone: row.phone ?? undefined,
    taxId: row.tax_id ?? undefined,
    points: row.points,
    totalSpent: money(row.total_spent) ?? 0,
    lastVisit: row.last_visit ?? undefined,
  };
}

function mapShift(row: ShiftRow) {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    storeId: row.store_id,
    registerId: row.register_id,
    userId: row.user_id,
    startTime: row.start_time,
    endTime: row.end_time ?? undefined,
    initialCash: money(row.initial_cash) ?? 0,
    expectedCash: money(row.expected_cash) ?? 0,
    actualCash: money(row.actual_cash),
    difference: money(row.difference),
    status: row.status,
    salesCash: money(row.sales_cash) ?? 0,
    salesCard: money(row.sales_card) ?? 0,
    cashOut: money(row.cash_out) ?? 0,
  };
}

async function saleDetails(client: QueryClient, sale: SaleRow) {
  const items = await client.query<SaleItemRow>('SELECT * FROM sale_items WHERE sale_id = $1 ORDER BY id', [sale.id]);
  return {
    id: sale.id,
    externalId: sale.external_id ?? undefined,
    tenantId: sale.tenant_id,
    storeId: sale.store_id,
    registerId: sale.register_id,
    shiftId: sale.shift_id ?? undefined,
    cashierId: sale.cashier_id,
    clientId: sale.customer_id ?? undefined,
    datetime: sale.datetime,
    total: money(sale.total) ?? 0,
    paymentMethod: sale.payment_method,
    amountTendered: money(sale.amount_tendered) ?? 0,
    changeAmount: money(sale.change_amount) ?? 0,
    itemsCount: sale.items_count,
    items: items.rows.map((item) => ({
      id: item.id,
      saleId: item.sale_id,
      productId: item.product_id,
      name: item.product_name,
      quantity: item.quantity,
      price: money(item.price) ?? 0,
      cost: money(item.cost) ?? 0,
      subtotal: money(item.subtotal) ?? 0,
    })),
  };
}

async function productRows(client: QueryClient, tenantId: string, storeId: string) {
  return client.query<ProductRow>(
    `SELECT p.id, p.tenant_id, p.barcode, p.name, p.category, p.cost, p.price,
            COALESCE(i.stock, 0)::integer AS stock, COALESCE(i.min_stock, 0)::integer AS min_stock
     FROM products p
     LEFT JOIN inventory i ON i.product_id = p.id AND i.store_id = $2
     WHERE p.tenant_id = $1 AND p.active = true
     ORDER BY p.name`,
    [tenantId, storeId],
  );
}

export async function coreRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  app.get('/stores', async (request) => {
    const result = await database.query<{
      id: string; tenant_id: string; name: string; address: string; code: string;
    }>(
      `SELECT s.id, s.tenant_id, s.code, s.name, s.address
       FROM stores s JOIN user_store_access usa ON usa.store_id = s.id
       WHERE usa.user_id = $1 AND s.tenant_id = $2 AND s.active = true ORDER BY s.code`,
      [request.user.sub, request.user.tenantId],
    );
    return result.rows.map((row) => ({ id: row.id, tenantId: row.tenant_id, code: row.code, name: row.name, address: row.address }));
  });

  app.get('/registers', async (request) => {
    const query = parse(z.object({ storeId: uuid.optional() }), request.query);
    const storeId = query.storeId ?? request.user.storeId;
    const access = await database.query<{ id: string }>(
      'SELECT store_id AS id FROM user_store_access WHERE user_id = $1::uuid AND store_id = $2::uuid',
      [request.user.sub, storeId],
    );
    if (access.rowCount === 0) throw new HttpError(403, 'No tienes acceso a esta sucursal', 'STORE_ACCESS_DENIED');
    const registers = await database.query<{ id: string; store_id: string; code: string; name: string }>(
      'SELECT id, store_id, code, name FROM registers WHERE store_id = $1 AND active = true ORDER BY code',
      [storeId],
    );
    return registers.rows.map((row) => ({ id: row.id, storeId: row.store_id, code: row.code, name: row.name }));
  });

  app.get('/products', async (request) => {
    const context = await resolveStoreContext(request, database);
    const result = await productRows(database, request.user.tenantId, context.storeId);
    return result.rows.map(mapProduct);
  });

  app.post('/products', { preHandler: authorize('ADMIN', 'MANAGER') }, async (request, reply) => {
    const input = parse(productSchema, request.body);
    const created = await database.transaction(async (client) => {
      const context = await resolveStoreContext(request, client);
      const productId = randomUUID();
      await client.query(
        `INSERT INTO products (id, tenant_id, barcode, name, category, cost, price)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [productId, request.user.tenantId, input.barcode, input.name, input.category, input.cost, input.price],
      );
      await client.query(
        `INSERT INTO inventory (tenant_id, store_id, product_id, stock, min_stock)
         VALUES ($1, $2, $3, $4, $5)`,
        [request.user.tenantId, context.storeId, productId, input.stock, input.minStock],
      );
      if (input.stock > 0) {
        await client.query(
          `INSERT INTO stock_movements
            (id, tenant_id, store_id, product_id, user_id, type, quantity, reason)
           VALUES ($1, $2, $3, $4, $5, 'PURCHASE', $6, 'Inventario inicial')`,
          [randomUUID(), request.user.tenantId, context.storeId, productId, request.user.sub, input.stock],
        );
      }
      await audit(client, request, 'PRODUCT_CREATED', 'product', productId, { barcode: input.barcode });
      const products = await productRows(client, request.user.tenantId, context.storeId);
      const product = products.rows.find((row) => row.id === productId);
      if (!product) throw new HttpError(500, 'No se pudo recuperar el producto creado');
      return mapProduct(product);
    });
    return reply.status(201).send(created);
  });

  app.put('/products/:id', { preHandler: authorize('ADMIN', 'MANAGER') }, async (request) => {
    const { id } = parse(z.object({ id: uuid }), request.params);
    const input = parse(productSchema, request.body);
    return database.transaction(async (client) => {
      const context = await resolveStoreContext(request, client);
      const existing = await client.query<{ stock: number }>(
        `SELECT i.stock FROM products p JOIN inventory i ON i.product_id = p.id AND i.store_id = $3
         WHERE p.id = $1 AND p.tenant_id = $2 AND p.active = true FOR UPDATE`,
        [id, request.user.tenantId, context.storeId],
      );
      if (!existing.rows[0]) throw new HttpError(404, 'Producto no encontrado', 'PRODUCT_NOT_FOUND');
      await client.query(
        `UPDATE products SET barcode = $3, name = $4, category = $5, cost = $6, price = $7, updated_at = now()
         WHERE id = $1 AND tenant_id = $2`,
        [id, request.user.tenantId, input.barcode, input.name, input.category, input.cost, input.price],
      );
      await client.query(
        'UPDATE inventory SET stock = $3, min_stock = $4, updated_at = now() WHERE store_id = $1 AND product_id = $2',
        [context.storeId, id, input.stock, input.minStock],
      );
      const adjustment = input.stock - existing.rows[0].stock;
      if (adjustment !== 0) {
        await client.query(
          `INSERT INTO stock_movements
            (id, tenant_id, store_id, product_id, user_id, type, quantity, reason)
           VALUES ($1, $2, $3, $4, $5, 'ADJUSTMENT', $6, 'Ajuste manual')`,
          [randomUUID(), request.user.tenantId, context.storeId, id, request.user.sub, adjustment],
        );
      }
      await audit(client, request, 'PRODUCT_UPDATED', 'product', id, { adjustment });
      const products = await productRows(client, request.user.tenantId, context.storeId);
      return mapProduct(products.rows.find((row) => row.id === id)!);
    });
  });

  app.delete('/products/:id', { preHandler: authorize('ADMIN') }, async (request, reply) => {
    const { id } = parse(z.object({ id: uuid }), request.params);
    await database.transaction(async (client) => {
      const result = await client.query(
        'UPDATE products SET active = false, updated_at = now() WHERE id = $1 AND tenant_id = $2 AND active = true RETURNING id',
        [id, request.user.tenantId],
      );
      if (result.rowCount === 0) throw new HttpError(404, 'Producto no encontrado', 'PRODUCT_NOT_FOUND');
      await audit(client, request, 'PRODUCT_ARCHIVED', 'product', id);
    });
    return reply.status(204).send();
  });

  app.get('/customers', async (request) => {
    const result = await database.query<CustomerRow>(
      'SELECT * FROM customers WHERE tenant_id = $1 AND active = true ORDER BY name',
      [request.user.tenantId],
    );
    return result.rows.map(mapCustomer);
  });

  app.post('/customers', async (request, reply) => {
    const input = parse(customerSchema, request.body);
    const id = randomUUID();
    const result = await database.transaction(async (client) => {
      const inserted = await client.query<CustomerRow>(
        `INSERT INTO customers (id, tenant_id, name, email, phone, tax_id)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [id, request.user.tenantId, input.name, input.email || null, input.phone || null, input.taxId || null],
      );
      await audit(client, request, 'CUSTOMER_CREATED', 'customer', id);
      return mapCustomer(inserted.rows[0]!);
    });
    return reply.status(201).send(result);
  });

  app.put('/customers/:id', async (request) => {
    const { id } = parse(z.object({ id: uuid }), request.params);
    const input = parse(customerSchema, request.body);
    return database.transaction(async (client) => {
      const updated = await client.query<CustomerRow>(
        `UPDATE customers SET name = $3, email = $4, phone = $5, tax_id = $6, updated_at = now()
         WHERE id = $1 AND tenant_id = $2 AND active = true RETURNING *`,
        [id, request.user.tenantId, input.name, input.email || null, input.phone || null, input.taxId || null],
      );
      if (!updated.rows[0]) throw new HttpError(404, 'Cliente no encontrado', 'CUSTOMER_NOT_FOUND');
      await audit(client, request, 'CUSTOMER_UPDATED', 'customer', id);
      return mapCustomer(updated.rows[0]);
    });
  });

  app.delete('/customers/:id', { preHandler: authorize('ADMIN', 'MANAGER') }, async (request, reply) => {
    const { id } = parse(z.object({ id: uuid }), request.params);
    await database.transaction(async (client) => {
      const result = await client.query(
        'UPDATE customers SET active = false, updated_at = now() WHERE id = $1 AND tenant_id = $2 AND active = true RETURNING id',
        [id, request.user.tenantId],
      );
      if (result.rowCount === 0) throw new HttpError(404, 'Cliente no encontrado', 'CUSTOMER_NOT_FOUND');
      await audit(client, request, 'CUSTOMER_ARCHIVED', 'customer', id);
    });
    return reply.status(204).send();
  });

  app.get('/shifts/active', async (request) => {
    const context = await resolveStoreContext(request, database);
    const result = await database.query<ShiftRow>(
      `SELECT * FROM shifts WHERE tenant_id = $1 AND register_id = $2 AND user_id = $3 AND status = 'OPEN' LIMIT 1`,
      [request.user.tenantId, context.registerId, request.user.sub],
    );
    return result.rows[0] ? mapShift(result.rows[0]) : null;
  });

  app.get('/shifts', async (request) => {
    const context = await resolveStoreContext(request, database);
    const result = await database.query<ShiftRow>(
      'SELECT * FROM shifts WHERE tenant_id = $1 AND store_id = $2 ORDER BY start_time DESC LIMIT 200',
      [request.user.tenantId, context.storeId],
    );
    return result.rows.map(mapShift);
  });

  app.post('/shifts/open', async (request, reply) => {
    const input = parse(z.object({ initialCash: z.coerce.number().min(0).max(99_999_999) }), request.body);
    const shift = await database.transaction(async (client) => {
      const context = await resolveStoreContext(request, client);
      const existing = await client.query<{ id: string }>(
        `SELECT id FROM shifts WHERE register_id = $1 AND status = 'OPEN' FOR UPDATE`,
        [context.registerId],
      );
      if (existing.rowCount > 0) throw new HttpError(409, 'La caja ya tiene un turno abierto', 'SHIFT_ALREADY_OPEN');
      const id = randomUUID();
      const inserted = await client.query<ShiftRow>(
        `INSERT INTO shifts
          (id, tenant_id, store_id, register_id, user_id, initial_cash, expected_cash, status)
         VALUES ($1, $2, $3, $4, $5, $6, $6, 'OPEN') RETURNING *`,
        [id, request.user.tenantId, context.storeId, context.registerId, request.user.sub, input.initialCash],
      );
      await audit(client, request, 'SHIFT_OPENED', 'shift', id, { initialCash: input.initialCash });
      return mapShift(inserted.rows[0]!);
    });
    return reply.status(201).send(shift);
  });

  app.post('/shifts/:id/close', async (request) => {
    const { id } = parse(z.object({ id: uuid }), request.params);
    const input = parse(z.object({ actualCash: z.coerce.number().min(0).max(99_999_999) }), request.body);
    return database.transaction(async (client) => {
      const context = await resolveStoreContext(request, client);
      const result = await client.query<ShiftRow>(
        `UPDATE shifts SET status = 'CLOSED', end_time = now(), actual_cash = $4,
           difference = $4 - expected_cash
         WHERE id = $1 AND tenant_id = $2 AND register_id = $3 AND user_id = $5 AND status = 'OPEN'
         RETURNING *`,
        [id, request.user.tenantId, context.registerId, input.actualCash, request.user.sub],
      );
      if (!result.rows[0]) throw new HttpError(404, 'Turno activo no encontrado', 'SHIFT_NOT_FOUND');
      await audit(client, request, 'SHIFT_CLOSED', 'shift', id, { actualCash: input.actualCash });
      return mapShift(result.rows[0]);
    });
  });

  app.post('/sales', async (request, reply) => {
    const input = parse(saleSchema, request.body);
    const sale = await database.transaction(async (client) => {
      const context = await resolveStoreContext(request, client);
      if (input.externalId) {
        const duplicate = await client.query<SaleRow>(
          'SELECT * FROM sales WHERE tenant_id = $1 AND external_id = $2',
          [request.user.tenantId, input.externalId],
        );
        if (duplicate.rows[0]) return saleDetails(client, duplicate.rows[0]);
      }

      const shiftResult = await client.query<ShiftRow>(
        `SELECT * FROM shifts WHERE tenant_id = $1 AND register_id = $2 AND user_id = $3 AND status = 'OPEN' FOR UPDATE`,
        [request.user.tenantId, context.registerId, request.user.sub],
      );
      const shift = shiftResult.rows[0];
      if (!shift) throw new HttpError(409, 'Debes abrir un turno antes de vender', 'SHIFT_REQUIRED');

      const lines: Array<{ product: ProductRow; quantity: number }> = [];
      for (const requested of input.items) {
        const product = await client.query<ProductRow>(
          `SELECT p.id, p.tenant_id, p.barcode, p.name, p.category, p.cost, p.price,
                  i.stock::integer, i.min_stock::integer
           FROM products p JOIN inventory i ON i.product_id = p.id AND i.store_id = $3
           WHERE p.id = $1 AND p.tenant_id = $2 AND p.active = true FOR UPDATE`,
          [requested.id, request.user.tenantId, context.storeId],
        );
        const row = product.rows[0];
        if (!row) throw new HttpError(404, 'Uno de los productos ya no esta disponible', 'PRODUCT_NOT_FOUND');
        if (row.stock < requested.quantity) throw new HttpError(409, `Stock insuficiente para ${row.name}`, 'INSUFFICIENT_STOCK');
        lines.push({ product: row, quantity: requested.quantity });
      }

      if (input.clientId) {
        const customer = await client.query<{ id: string }>(
          'SELECT id FROM customers WHERE id = $1 AND tenant_id = $2 AND active = true',
          [input.clientId, request.user.tenantId],
        );
        if (customer.rowCount === 0) throw new HttpError(404, 'Cliente no encontrado', 'CUSTOMER_NOT_FOUND');
      }

      const total = roundMoney(lines.reduce((sum, line) => sum + Number(line.product.price) * line.quantity, 0));
      if (input.paymentMethod === 'CASH' && input.amountTendered < total) {
        throw new HttpError(400, 'El efectivo recibido es menor al total', 'INSUFFICIENT_PAYMENT');
      }
      const change = input.paymentMethod === 'CASH' ? roundMoney(input.amountTendered - total) : 0;
      const saleId = randomUUID();
      const inserted = await client.query<SaleRow>(
        `INSERT INTO sales
          (id, external_id, tenant_id, store_id, register_id, shift_id, cashier_id, customer_id,
           datetime, total, payment_method, amount_tendered, change_amount, items_count)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, COALESCE($9::timestamptz, now()), $10, $11, $12, $13, $14)
         RETURNING *`,
        [saleId, input.externalId ?? null, request.user.tenantId, context.storeId, context.registerId,
          shift.id, request.user.sub, input.clientId ?? null, input.offlineDate ?? null, total,
          input.paymentMethod, input.amountTendered, change, lines.reduce((sum, line) => sum + line.quantity, 0)],
      );

      for (const line of lines) {
        const subtotal = roundMoney(Number(line.product.price) * line.quantity);
        await client.query(
          `INSERT INTO sale_items
            (id, sale_id, product_id, product_name, quantity, price, cost, subtotal)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [randomUUID(), saleId, line.product.id, line.product.name, line.quantity,
            line.product.price, line.product.cost, subtotal],
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
          [randomUUID(), request.user.tenantId, context.storeId, line.product.id, request.user.sub,
            saleId, -line.quantity, input.offlineDate ?? null, `Venta ${saleId}`],
        );
      }

      if (input.clientId) {
        await client.query(
          `UPDATE customers SET points = points + $3, total_spent = total_spent + $4,
             last_visit = COALESCE($5::timestamptz, now()), updated_at = now()
           WHERE id = $1 AND tenant_id = $2`,
          [input.clientId, request.user.tenantId, Math.floor(total * 0.01), total, input.offlineDate ?? null],
        );
      }

      if (input.paymentMethod === 'CASH') {
        await client.query(
          'UPDATE shifts SET sales_cash = sales_cash + $2, expected_cash = expected_cash + $2 WHERE id = $1',
          [shift.id, total],
        );
      } else {
        await client.query('UPDATE shifts SET sales_card = sales_card + $2 WHERE id = $1', [shift.id, total]);
      }
      await audit(client, request, 'SALE_CREATED', 'sale', saleId, { total, paymentMethod: input.paymentMethod });
      return saleDetails(client, inserted.rows[0]!);
    });
    return reply.status(201).send(sale);
  });

  app.get('/sales', async (request) => {
    const context = await resolveStoreContext(request, database);
    const result = await database.query<SaleRow>(
      'SELECT * FROM sales WHERE tenant_id = $1 AND store_id = $2 ORDER BY datetime DESC LIMIT 500',
      [request.user.tenantId, context.storeId],
    );
    return Promise.all(result.rows.map((sale) => saleDetails(database, sale)));
  });

  app.get('/stock-movements', async (request) => {
    const context = await resolveStoreContext(request, database);
    const result = await database.query<{
      id: string; tenant_id: string; store_id: string; product_id: string; user_id: string;
      type: string; quantity: number; date: string; reason: string; product_name: string; user_name: string;
    }>(
      `SELECT m.id, m.tenant_id, m.store_id, m.product_id, m.user_id, m.type, m.quantity,
              m.date, m.reason, p.name AS product_name, u.display_name AS user_name
       FROM stock_movements m
       JOIN products p ON p.id = m.product_id
       JOIN users u ON u.id = m.user_id
       WHERE m.tenant_id = $1 AND m.store_id = $2 ORDER BY m.date DESC LIMIT 1000`,
      [request.user.tenantId, context.storeId],
    );
    return result.rows.map((row) => ({
      id: row.id,
      tenantId: row.tenant_id,
      storeId: row.store_id,
      productId: row.product_id,
      userId: row.user_id,
      type: row.type,
      quantity: row.quantity,
      date: row.date,
      reason: row.reason,
      productName: row.product_name,
      userName: row.user_name,
    }));
  });

  app.get('/audit-events', { preHandler: authorize('ADMIN') }, async (request: FastifyRequest) => {
    const result = await database.query(
      'SELECT * FROM audit_events WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 500',
      [request.user.tenantId],
    );
    return result.rows;
  });
}
