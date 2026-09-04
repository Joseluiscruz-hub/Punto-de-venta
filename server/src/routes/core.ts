import { randomUUID } from 'node:crypto';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { config } from '../config.js';
import { database, type QueryClient } from '../database.js';
import { audit, authenticate, authorize, HttpError, parse, resolveStoreContext } from '../http.js';

const uuid = z.string().uuid();
const imageUrlSchema = z
  .string()
  .trim()
  .max(2048)
  .refine(
    (value) => value === '' || /^https?:\/\//i.test(value) || value.startsWith('/'),
    'La imagen debe ser una URL http(s) o una ruta local que empiece con /',
  )
  .optional()
  .transform((value) => value || undefined);
const productSchema = z.object({
  barcode: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(200),
  category: z.string().trim().min(1).max(100),
  imageUrl: imageUrlSchema,
  cost: z.coerce.number().min(0).max(99_999_999),
  price: z.coerce.number().min(0).max(99_999_999),
  stock: z.coerce.number().int().min(0).max(99_999_999),
  minStock: z.coerce.number().int().min(0).max(99_999_999),
});
const updateProductSchema = productSchema.extend({
  expectedStock: z.coerce.number().int().min(0).max(99_999_999),
});
const productsBulkSchema = z.object({
  products: z.array(productSchema).min(1).max(1000),
});
const customerSchema = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().email().max(200).optional().or(z.literal('')),
  phone: z.string().trim().max(30).optional(),
  taxId: z.string().trim().max(30).optional(),
});
const saleSchema = z.object({
  externalId: z.string().trim().min(1).max(100).optional(),
  items: z
    .array(z.object({ id: uuid, quantity: z.coerce.number().int().positive() }))
    .min(1)
    .max(200),
  paymentMethod: z.enum(['CASH', 'CARD', 'TRANSFER', 'MIXED']),
  amountTendered: z.coerce.number().min(0).max(99_999_999),
  clientId: uuid.optional(),
  offlineDate: z.string().datetime().optional(),
});
const returnSaleSchema = z.object({
  items: z
    .array(
      z.object({
        saleItemId: uuid,
        quantity: z.coerce.number().int().positive().max(99_999_999),
      }),
    )
    .min(1)
    .max(200),
  refundMethod: z.enum(['CASH', 'STORE_CREDIT']),
  reason: z.string().trim().min(3).max(500),
});
const cashMovementSchema = z.object({
  externalId: z.string().trim().min(1).max(100),
  type: z.enum(['CASH_IN', 'CASH_OUT']),
  amount: z.coerce
    .number()
    .positive()
    .max(99_999_999)
    .refine((value) => roundMoney(value) === value, 'El monto admite como máximo dos decimales'),
  reason: z.string().trim().min(3).max(300),
});
const optionalQueryString = () =>
  z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    z.string().trim().optional(),
  );
const optionalIsoDatetime = () =>
  optionalQueryString().refine(
    (value) => value === undefined || !Number.isNaN(Date.parse(value)),
    'Fecha inválida',
  );
const auditEventsQuerySchema = z.object({
  action: optionalQueryString(),
  entityType: optionalQueryString(),
  storeId: z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    uuid.optional(),
  ),
  from: optionalIsoDatetime(),
  to: optionalIsoDatetime(),
  q: optionalQueryString(),
  limit: z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    z.coerce.number().int().min(1).max(1000).optional(),
  ),
});

interface ProductRow {
  id: string;
  tenant_id: string;
  barcode: string;
  name: string;
  category: string;
  image_url?: string | null;
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
  store_credit: string | number;
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
  refunds_cash: string | number;
  cash_in: string | number;
  cash_out: string | number;
}

interface CashMovementRow {
  id: string;
  external_id: string;
  tenant_id: string;
  store_id: string;
  register_id: string;
  shift_id: string;
  user_id: string;
  type: 'CASH_IN' | 'CASH_OUT';
  amount: string | number;
  reason: string;
  created_at: string;
}

interface AuditEventRow {
  id: string;
  tenant_id: string;
  actor_user_id: string | null;
  actor_name: string | null;
  store_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: Record<string, unknown> | string | null;
  ip_address: string | null;
  created_at: string;
}

function parseAuditDetails(value: AuditEventRow['details']) {
  if (!value) return {};
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return value;
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
  returned_quantity?: number;
}

interface SaleReturnRow {
  id: string;
  tenant_id: string;
  store_id: string;
  sale_id: string;
  shift_id: string;
  user_id: string;
  refund_method: 'CASH' | 'STORE_CREDIT';
  total: string | number;
  reason: string;
  created_at: string;
}

interface SaleReturnItemRow {
  id: string;
  return_id: string;
  sale_item_id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  price: string | number;
  subtotal: string | number;
}

const money = (value: string | number | null) => (value === null ? undefined : Number(value));
const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const genericDemoProductNames = new Map([
  ['Leche Entera Alpura 1L', 'Leche entera 1L'],
  ['Pan Bimbo Blanco', 'Pan blanco 680g'],
  ['Coca-Cola 600ml', 'Refresco cola 600ml'],
]);

function genericProductName(name: string) {
  return genericDemoProductNames.get(name) ?? name;
}

function mapProduct(row: ProductRow) {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    barcode: row.barcode,
    name: genericProductName(row.name),
    category: row.category,
    imageUrl: row.image_url ?? undefined,
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
    storeCredit: money(row.store_credit) ?? 0,
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
    refundsCash: money(row.refunds_cash) ?? 0,
    cashIn: money(row.cash_in) ?? 0,
    cashOut: money(row.cash_out) ?? 0,
    differenceThreshold: config.CASH_DIFFERENCE_THRESHOLD,
  };
}

function mapCashMovement(row: CashMovementRow) {
  return {
    id: row.id,
    externalId: row.external_id,
    tenantId: row.tenant_id,
    storeId: row.store_id,
    registerId: row.register_id,
    shiftId: row.shift_id,
    userId: row.user_id,
    type: row.type,
    amount: money(row.amount) ?? 0,
    reason: row.reason,
    createdAt: row.created_at,
  };
}

function canOperateShift(request: FastifyRequest, shift: ShiftRow) {
  return (
    shift.user_id === request.user.sub ||
    request.user.role === 'ADMIN' ||
    request.user.role === 'MANAGER'
  );
}

function assertCanOperateShift(request: FastifyRequest, shift: ShiftRow) {
  if (!canOperateShift(request, shift)) {
    throw new HttpError(
      403,
      'La caja está abierta por otro cajero. Solicita apoyo de un administrador o gerente.',
      'SHIFT_ACCESS_DENIED',
    );
  }
}

function assertSaleReplayScope(
  request: FastifyRequest,
  context: { storeId: string; registerId: string },
  sale: SaleRow,
) {
  if (
    sale.store_id !== context.storeId ||
    sale.register_id !== context.registerId ||
    (sale.cashier_id !== request.user.sub &&
      request.user.role !== 'ADMIN' &&
      request.user.role !== 'MANAGER')
  ) {
    throw new HttpError(
      409,
      'El identificador de la venta ya fue utilizado en otra operación',
      'IDEMPOTENCY_KEY_REUSED',
    );
  }
}

function assertCashMovementReplayScope(
  request: FastifyRequest,
  context: { storeId: string; registerId: string },
  shiftId: string,
  movement: CashMovementRow,
) {
  if (
    movement.store_id !== context.storeId ||
    movement.register_id !== context.registerId ||
    movement.shift_id !== shiftId ||
    (movement.user_id !== request.user.sub &&
      request.user.role !== 'ADMIN' &&
      request.user.role !== 'MANAGER')
  ) {
    throw new HttpError(
      409,
      'El identificador del movimiento ya fue utilizado en otra operación',
      'IDEMPOTENCY_KEY_REUSED',
    );
  }
}

async function saleDetails(client: QueryClient, sale: SaleRow) {
  const items = await client.query<SaleItemRow>(
    `SELECT si.*,
            COALESCE((SELECT SUM(sri.quantity) FROM sale_return_items sri
                      WHERE sri.sale_item_id = si.id), 0)::integer AS returned_quantity
     FROM sale_items si WHERE si.sale_id = $1 ORDER BY si.id`,
    [sale.id],
  );
  const returnSummary = await client.query<{ returned_total: string | number }>(
    'SELECT COALESCE(SUM(total), 0) AS returned_total FROM sale_returns WHERE sale_id = $1',
    [sale.id],
  );
  const returnedTotal = money(returnSummary.rows[0]?.returned_total ?? 0) ?? 0;
  const fullyReturned =
    items.rows.length > 0 &&
    items.rows.every((item) => (item.returned_quantity ?? 0) >= item.quantity);
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
      returnedQuantity: item.returned_quantity ?? 0,
    })),
    returnedTotal,
    returnStatus: returnedTotal === 0 ? 'NONE' : fullyReturned ? 'FULL' : 'PARTIAL',
  };
}

async function productRows(client: QueryClient, tenantId: string, storeId: string) {
  return client.query<ProductRow>(
    `SELECT p.id, p.tenant_id, p.barcode, p.name, p.category, p.image_url, p.cost, p.price,
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
      id: string;
      tenant_id: string;
      name: string;
      address: string;
      code: string;
    }>(
      `SELECT s.id, s.tenant_id, s.code, s.name, s.address
       FROM stores s JOIN user_store_access usa ON usa.store_id = s.id
       WHERE usa.user_id = $1 AND s.tenant_id = $2 AND s.active = true ORDER BY s.code`,
      [request.user.sub, request.user.tenantId],
    );
    return result.rows.map((row) => ({
      id: row.id,
      tenantId: row.tenant_id,
      code: row.code,
      name: row.name,
      address: row.address,
    }));
  });

  app.get('/registers', async (request) => {
    const query = parse(z.object({ storeId: uuid.optional() }), request.query);
    const storeId = query.storeId ?? request.user.storeId;
    const access = await database.query<{ id: string }>(
      'SELECT store_id AS id FROM user_store_access WHERE user_id = $1::uuid AND store_id = $2::uuid',
      [request.user.sub, storeId],
    );
    if (access.rowCount === 0)
      throw new HttpError(403, 'No tienes acceso a esta sucursal', 'STORE_ACCESS_DENIED');
    const registers = await database.query<{
      id: string;
      store_id: string;
      code: string;
      name: string;
    }>(
      'SELECT id, store_id, code, name FROM registers WHERE store_id = $1 AND active = true ORDER BY code',
      [storeId],
    );
    return registers.rows.map((row) => ({
      id: row.id,
      storeId: row.store_id,
      code: row.code,
      name: row.name,
    }));
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
        `INSERT INTO products (id, tenant_id, barcode, name, category, image_url, cost, price)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          productId,
          request.user.tenantId,
          input.barcode,
          input.name,
          input.category,
          input.imageUrl ?? null,
          input.cost,
          input.price,
        ],
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
          [
            randomUUID(),
            request.user.tenantId,
            context.storeId,
            productId,
            request.user.sub,
            input.stock,
          ],
        );
      }
      await audit(client, request, 'PRODUCT_CREATED', 'product', productId, {
        barcode: input.barcode,
      });
      const products = await productRows(client, request.user.tenantId, context.storeId);
      const product = products.rows.find((row) => row.id === productId);
      if (!product) throw new HttpError(500, 'No se pudo recuperar el producto creado');
      return mapProduct(product);
    });
    return reply.status(201).send(created);
  });

  app.post(
    '/products/bulk',
    { preHandler: authorize('ADMIN', 'MANAGER') },
    async (request, reply) => {
      const input = parse(productsBulkSchema, request.body);
      const created = await database.transaction(async (client) => {
        const context = await resolveStoreContext(request, client);
        const seen = new Set<string>();
        for (const product of input.products) {
          if (seen.has(product.barcode)) {
            throw new HttpError(
              400,
              `El archivo contiene codigos repetidos: ${product.barcode}`,
              'DUPLICATE_IMPORT_BARCODE',
            );
          }
          seen.add(product.barcode);
        }

        for (const product of input.products) {
          const duplicate = await client.query<{ id: string }>(
            'SELECT id FROM products WHERE tenant_id = $1 AND barcode = $2 LIMIT 1',
            [request.user.tenantId, product.barcode],
          );
          if (duplicate.rowCount > 0) {
            throw new HttpError(
              409,
              `Ya existe un producto con el codigo ${product.barcode}`,
              'DUPLICATE_RECORD',
            );
          }
        }

        const createdProducts: Array<ReturnType<typeof mapProduct>> = [];
        for (const product of input.products) {
          const productId = randomUUID();
          await client.query(
            `INSERT INTO products (id, tenant_id, barcode, name, category, image_url, cost, price)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
              productId,
              request.user.tenantId,
              product.barcode,
              product.name,
              product.category,
              product.imageUrl ?? null,
              product.cost,
              product.price,
            ],
          );
          await client.query(
            `INSERT INTO inventory (tenant_id, store_id, product_id, stock, min_stock)
             VALUES ($1, $2, $3, $4, $5)`,
            [request.user.tenantId, context.storeId, productId, product.stock, product.minStock],
          );
          if (product.stock > 0) {
            await client.query(
              `INSERT INTO stock_movements
                (id, tenant_id, store_id, product_id, user_id, type, quantity, reason)
               VALUES ($1, $2, $3, $4, $5, 'PURCHASE', $6, 'Importacion inicial')`,
              [
                randomUUID(),
                request.user.tenantId,
                context.storeId,
                productId,
                request.user.sub,
                product.stock,
              ],
            );
          }
          createdProducts.push({
            id: productId,
            tenantId: request.user.tenantId,
            barcode: product.barcode,
            name: product.name,
            category: product.category,
            imageUrl: product.imageUrl,
            cost: product.cost,
            price: product.price,
            stock: product.stock,
            minStock: product.minStock,
          });
        }

        await audit(client, request, 'PRODUCTS_BULK_IMPORTED', 'product_import', undefined, {
          count: createdProducts.length,
        });
        return createdProducts;
      });
      return reply.status(201).send({ created });
    },
  );

  app.put('/products/:id', { preHandler: authorize('ADMIN', 'MANAGER') }, async (request) => {
    const { id } = parse(z.object({ id: uuid }), request.params);
    const input = parse(updateProductSchema, request.body);
    return database.transaction(async (client) => {
      const context = await resolveStoreContext(request, client);
      const existing = await client.query<{ stock: number }>(
        `SELECT i.stock FROM products p JOIN inventory i ON i.product_id = p.id AND i.store_id = $3
         WHERE p.id = $1 AND p.tenant_id = $2 AND p.active = true FOR UPDATE`,
        [id, request.user.tenantId, context.storeId],
      );
      if (!existing.rows[0])
        throw new HttpError(404, 'Producto no encontrado', 'PRODUCT_NOT_FOUND');
      if (existing.rows[0].stock !== input.expectedStock) {
        throw new HttpError(
          409,
          'La existencia cambio mientras editabas. Recarga el producto antes de ajustar el stock.',
          'INVENTORY_CHANGED',
        );
      }
      await client.query(
        `UPDATE products SET barcode = $3, name = $4, category = $5, image_url = $6, cost = $7, price = $8, updated_at = now()
         WHERE id = $1 AND tenant_id = $2`,
        [
          id,
          request.user.tenantId,
          input.barcode,
          input.name,
          input.category,
          input.imageUrl ?? null,
          input.cost,
          input.price,
        ],
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
      if (result.rowCount === 0)
        throw new HttpError(404, 'Producto no encontrado', 'PRODUCT_NOT_FOUND');
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
        [
          id,
          request.user.tenantId,
          input.name,
          input.email || null,
          input.phone || null,
          input.taxId || null,
        ],
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
        [
          id,
          request.user.tenantId,
          input.name,
          input.email || null,
          input.phone || null,
          input.taxId || null,
        ],
      );
      if (!updated.rows[0]) throw new HttpError(404, 'Cliente no encontrado', 'CUSTOMER_NOT_FOUND');
      await audit(client, request, 'CUSTOMER_UPDATED', 'customer', id);
      return mapCustomer(updated.rows[0]);
    });
  });

  app.delete(
    '/customers/:id',
    { preHandler: authorize('ADMIN', 'MANAGER') },
    async (request, reply) => {
      const { id } = parse(z.object({ id: uuid }), request.params);
      await database.transaction(async (client) => {
        const result = await client.query(
          'UPDATE customers SET active = false, updated_at = now() WHERE id = $1 AND tenant_id = $2 AND active = true RETURNING id',
          [id, request.user.tenantId],
        );
        if (result.rowCount === 0)
          throw new HttpError(404, 'Cliente no encontrado', 'CUSTOMER_NOT_FOUND');
        await audit(client, request, 'CUSTOMER_ARCHIVED', 'customer', id);
      });
      return reply.status(204).send();
    },
  );

  app.get('/shifts/active', async (request) => {
    const context = await resolveStoreContext(request, database);
    const result = await database.query<ShiftRow>(
      `SELECT * FROM shifts WHERE tenant_id = $1 AND register_id = $2 AND status = 'OPEN' LIMIT 1`,
      [request.user.tenantId, context.registerId],
    );
    const shift = result.rows[0];
    if (!shift) return null;
    assertCanOperateShift(request, shift);
    return mapShift(shift);
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
    const input = parse(
      z.object({ initialCash: z.coerce.number().min(0).max(99_999_999) }),
      request.body,
    );
    const shift = await database.transaction(async (client) => {
      const context = await resolveStoreContext(request, client);
      const existing = await client.query<{ id: string }>(
        `SELECT id FROM shifts WHERE register_id = $1 AND status = 'OPEN' FOR UPDATE`,
        [context.registerId],
      );
      if (existing.rowCount > 0)
        throw new HttpError(409, 'La caja ya tiene un turno abierto', 'SHIFT_ALREADY_OPEN');
      const id = randomUUID();
      const inserted = await client.query<ShiftRow>(
        `INSERT INTO shifts
          (id, tenant_id, store_id, register_id, user_id, initial_cash, expected_cash, status)
         VALUES ($1, $2, $3, $4, $5, $6, $6, 'OPEN') RETURNING *`,
        [
          id,
          request.user.tenantId,
          context.storeId,
          context.registerId,
          request.user.sub,
          input.initialCash,
        ],
      );
      await audit(client, request, 'SHIFT_OPENED', 'shift', id, { initialCash: input.initialCash });
      return mapShift(inserted.rows[0]!);
    });
    return reply.status(201).send(shift);
  });

  app.post('/shifts/:id/close', async (request) => {
    const { id } = parse(z.object({ id: uuid }), request.params);
    const input = parse(
      z.object({ actualCash: z.coerce.number().min(0).max(99_999_999) }),
      request.body,
    );
    return database.transaction(async (client) => {
      const context = await resolveStoreContext(request, client);
      const canCloseOtherShift = request.user.role === 'ADMIN' || request.user.role === 'MANAGER';
      const result = await client.query<ShiftRow>(
        `UPDATE shifts SET status = 'CLOSED', end_time = now(), actual_cash = $4,
           difference = $4 - expected_cash
         WHERE id = $1 AND tenant_id = $2 AND register_id = $3
           AND (user_id = $5 OR $6::boolean) AND status = 'OPEN'
         RETURNING *`,
        [
          id,
          request.user.tenantId,
          context.registerId,
          input.actualCash,
          request.user.sub,
          canCloseOtherShift,
        ],
      );
      if (!result.rows[0])
        throw new HttpError(404, 'Turno activo no encontrado', 'SHIFT_NOT_FOUND');
      const difference = money(result.rows[0].difference) ?? 0;
      await audit(client, request, 'SHIFT_CLOSED', 'shift', id, {
        actualCash: input.actualCash,
        difference,
        exceedsThreshold: Math.abs(difference) > config.CASH_DIFFERENCE_THRESHOLD,
        differenceThreshold: config.CASH_DIFFERENCE_THRESHOLD,
        openedByUserId: result.rows[0].user_id,
        closedByDifferentUser: result.rows[0].user_id !== request.user.sub,
      });
      return mapShift(result.rows[0]);
    });
  });

  app.get('/shifts/:id/cash-movements', async (request) => {
    const { id } = parse(z.object({ id: uuid }), request.params);
    const context = await resolveStoreContext(request, database);
    const shift = await database.query<{ id: string }>(
      'SELECT id FROM shifts WHERE id = $1 AND tenant_id = $2 AND store_id = $3',
      [id, request.user.tenantId, context.storeId],
    );
    if (shift.rowCount === 0) throw new HttpError(404, 'Turno no encontrado', 'SHIFT_NOT_FOUND');
    const result = await database.query<CashMovementRow>(
      'SELECT * FROM cash_movements WHERE shift_id = $1 ORDER BY created_at DESC, id DESC',
      [id],
    );
    return result.rows.map(mapCashMovement);
  });

  app.post('/shifts/:id/cash-movements', async (request, reply) => {
    const { id } = parse(z.object({ id: uuid }), request.params);
    const input = parse(cashMovementSchema, request.body);
    const result = await database.transaction(async (client) => {
      const context = await resolveStoreContext(request, client);
      const duplicate = await client.query<CashMovementRow>(
        'SELECT * FROM cash_movements WHERE tenant_id = $1 AND external_id = $2',
        [request.user.tenantId, input.externalId],
      );
      if (duplicate.rows[0]) {
        assertCashMovementReplayScope(request, context, id, duplicate.rows[0]);
        return mapCashMovement(duplicate.rows[0]);
      }

      const shiftResult = await client.query<ShiftRow>(
        `SELECT * FROM shifts
         WHERE id = $1 AND tenant_id = $2 AND store_id = $3 AND register_id = $4
           AND status = 'OPEN'
         FOR UPDATE`,
        [id, request.user.tenantId, context.storeId, context.registerId],
      );
      const shift = shiftResult.rows[0];
      if (!shift) throw new HttpError(404, 'Turno activo no encontrado', 'SHIFT_NOT_FOUND');
      assertCanOperateShift(request, shift);
      if (input.type === 'CASH_OUT' && input.amount > Number(shift.expected_cash)) {
        throw new HttpError(
          409,
          'El retiro no puede ser mayor al efectivo esperado en caja',
          'INSUFFICIENT_CASH',
        );
      }

      const movementId = randomUUID();
      const inserted = await client.query<CashMovementRow>(
        `INSERT INTO cash_movements
          (id, external_id, tenant_id, store_id, register_id, shift_id, user_id, type, amount, reason)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (tenant_id, external_id) DO NOTHING
         RETURNING *`,
        [
          movementId,
          input.externalId,
          request.user.tenantId,
          context.storeId,
          context.registerId,
          id,
          request.user.sub,
          input.type,
          input.amount,
          input.reason,
        ],
      );
      if (!inserted.rows[0]) {
        const existing = await client.query<CashMovementRow>(
          'SELECT * FROM cash_movements WHERE tenant_id = $1 AND external_id = $2',
          [request.user.tenantId, input.externalId],
        );
        if (!existing.rows[0]) {
          throw new HttpError(409, 'No se pudo confirmar el movimiento', 'IDEMPOTENCY_CONFLICT');
        }
        assertCashMovementReplayScope(request, context, id, existing.rows[0]);
        return mapCashMovement(existing.rows[0]);
      }
      if (input.type === 'CASH_IN') {
        await client.query(
          'UPDATE shifts SET cash_in = cash_in + $2, expected_cash = expected_cash + $2 WHERE id = $1',
          [id, input.amount],
        );
      } else {
        await client.query(
          'UPDATE shifts SET cash_out = cash_out + $2, expected_cash = expected_cash - $2 WHERE id = $1',
          [id, input.amount],
        );
      }
      await audit(client, request, input.type, 'cash_movement', movementId, {
        shiftId: id,
        amount: input.amount,
        reason: input.reason,
      });
      return mapCashMovement(inserted.rows[0]!);
    });
    return reply.status(201).send(result);
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
        if (duplicate.rows[0]) {
          assertSaleReplayScope(request, context, duplicate.rows[0]);
          return saleDetails(client, duplicate.rows[0]);
        }
      }

      const shiftResult = await client.query<ShiftRow>(
        `SELECT * FROM shifts WHERE tenant_id = $1 AND register_id = $2 AND status = 'OPEN' FOR UPDATE`,
        [request.user.tenantId, context.registerId],
      );
      const shift = shiftResult.rows[0];
      if (!shift)
        throw new HttpError(409, 'Debes abrir un turno antes de vender', 'SHIFT_REQUIRED');
      assertCanOperateShift(request, shift);

      const requestedItems = Array.from(
        input.items
          .reduce(
            (items, item) => items.set(item.id, (items.get(item.id) ?? 0) + item.quantity),
            new Map<string, number>(),
          )
          .entries(),
        ([id, quantity]) => ({ id, quantity }),
      );
      const lines: Array<{ product: ProductRow; quantity: number }> = [];
      for (const requested of requestedItems) {
        const product = await client.query<ProductRow>(
          `SELECT p.id, p.tenant_id, p.barcode, p.name, p.category, p.image_url, p.cost, p.price,
                  i.stock::integer, i.min_stock::integer
           FROM products p JOIN inventory i ON i.product_id = p.id AND i.store_id = $3
           WHERE p.id = $1 AND p.tenant_id = $2 AND p.active = true FOR UPDATE`,
          [requested.id, request.user.tenantId, context.storeId],
        );
        const row = product.rows[0];
        if (!row)
          throw new HttpError(
            404,
            'Uno de los productos ya no esta disponible',
            'PRODUCT_NOT_FOUND',
          );
        if (row.stock < requested.quantity)
          throw new HttpError(409, `Stock insuficiente para ${row.name}`, 'INSUFFICIENT_STOCK');
        lines.push({ product: row, quantity: requested.quantity });
      }

      if (input.clientId) {
        const customer = await client.query<{ id: string }>(
          'SELECT id FROM customers WHERE id = $1 AND tenant_id = $2 AND active = true',
          [input.clientId, request.user.tenantId],
        );
        if (customer.rowCount === 0)
          throw new HttpError(404, 'Cliente no encontrado', 'CUSTOMER_NOT_FOUND');
      }

      const total = roundMoney(
        lines.reduce((sum, line) => sum + Number(line.product.price) * line.quantity, 0),
      );
      if (input.paymentMethod === 'CASH' && input.amountTendered < total) {
        throw new HttpError(400, 'El efectivo recibido es menor al total', 'INSUFFICIENT_PAYMENT');
      }
      if (
        input.paymentMethod === 'MIXED' &&
        (input.amountTendered <= 0 || input.amountTendered >= total)
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
      const inserted = await client.query<SaleRow>(
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
        const existing = await client.query<SaleRow>(
          'SELECT * FROM sales WHERE tenant_id = $1 AND external_id = $2',
          [request.user.tenantId, input.externalId],
        );
        if (!existing.rows[0]) {
          throw new HttpError(409, 'No se pudo confirmar la venta', 'IDEMPOTENCY_CONFLICT');
        }
        assertSaleReplayScope(request, context, existing.rows[0]);
        return saleDetails(client, existing.rows[0]);
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
      return saleDetails(client, inserted.rows[0]!);
    });
    return reply.status(201).send(sale);
  });

  app.post('/sales/:id/return', async (request, reply) => {
    const { id: saleId } = parse(z.object({ id: uuid }), request.params);
    const input = parse(returnSaleSchema, request.body);
    const result = await database.transaction(async (client) => {
      const context = await resolveStoreContext(request, client);
      const saleResult = await client.query<SaleRow>(
        `SELECT * FROM sales
         WHERE id = $1 AND tenant_id = $2 AND store_id = $3
         FOR UPDATE`,
        [saleId, request.user.tenantId, context.storeId],
      );
      const sale = saleResult.rows[0];
      if (!sale) throw new HttpError(404, 'Venta no encontrada', 'SALE_NOT_FOUND');

      const shiftResult = await client.query<ShiftRow>(
        `SELECT * FROM shifts
         WHERE tenant_id = $1 AND register_id = $2 AND status = 'OPEN'
         FOR UPDATE`,
        [request.user.tenantId, context.registerId],
      );
      const shift = shiftResult.rows[0];
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

      const seen = new Set<string>();
      const lines: Array<{ item: SaleItemRow; quantity: number }> = [];
      for (const requested of input.items) {
        if (seen.has(requested.saleItemId)) {
          throw new HttpError(
            400,
            'Hay articulos repetidos en la devolucion',
            'DUPLICATE_RETURN_ITEM',
          );
        }
        seen.add(requested.saleItemId);
        const itemResult = await client.query<SaleItemRow>(
          `SELECT si.*,
                  COALESCE((SELECT SUM(sri.quantity) FROM sale_return_items sri
                            WHERE sri.sale_item_id = si.id), 0)::integer AS returned_quantity
           FROM sale_items si
           WHERE si.id = $1 AND si.sale_id = $2`,
          [requested.saleItemId, sale.id],
        );
        const item = itemResult.rows[0];
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
      const previousReturnSummary = await client.query<{ returned_total: string | number }>(
        'SELECT COALESCE(SUM(total), 0) AS returned_total FROM sale_returns WHERE sale_id = $1',
        [sale.id],
      );
      const previousReturnedTotal = money(previousReturnSummary.rows[0]?.returned_total ?? 0) ?? 0;
      const pointsToReverse =
        Math.floor((previousReturnedTotal + total) * 0.01) -
        Math.floor(previousReturnedTotal * 0.01);
      if (input.refundMethod === 'CASH' && (money(shift.expected_cash) ?? 0) < total) {
        throw new HttpError(
          409,
          'El efectivo esperado del turno no cubre el reembolso',
          'INSUFFICIENT_SHIFT_CASH',
        );
      }

      const returnId = randomUUID();
      const insertedReturn = await client.query<SaleReturnRow>(
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
        const returnItem = await client.query<SaleReturnItemRow>(
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
        returnedItems.push(returnItem.rows[0]!);
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

      const row = insertedReturn.rows[0]!;
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
      id: string;
      tenant_id: string;
      store_id: string;
      product_id: string;
      user_id: string;
      type: string;
      quantity: number;
      date: string;
      reason: string;
      product_name: string;
      user_name: string;
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

  app.get(
    '/audit-events',
    { preHandler: authorize('ADMIN', 'MANAGER') },
    async (request: FastifyRequest) => {
      const query = parse(auditEventsQuerySchema, request.query);
      if (query.storeId) {
        const storeAccess = await database.query<{ store_id: string }>(
          'SELECT store_id FROM user_store_access WHERE user_id = $1::uuid AND store_id = $2::uuid LIMIT 1',
          [request.user.sub, query.storeId],
        );
        if (storeAccess.rowCount === 0)
          throw new HttpError(403, 'No tienes acceso a esta sucursal', 'STORE_ACCESS_DENIED');
      }
      const whereParts = ['ae.tenant_id = $1'];
      const params: unknown[] = [request.user.tenantId];
      if (query.action) {
        whereParts.push(`ae.action = $${params.length + 1}`);
        params.push(query.action);
      }
      if (query.entityType) {
        whereParts.push(`ae.entity_type = $${params.length + 1}`);
        params.push(query.entityType);
      }
      if (query.storeId) {
        whereParts.push(`ae.store_id = $${params.length + 1}`);
        params.push(query.storeId);
      }
      if (query.from) {
        whereParts.push(`ae.created_at >= $${params.length + 1}::timestamptz`);
        params.push(query.from);
      }
      if (query.to) {
        whereParts.push(`ae.created_at <= $${params.length + 1}::timestamptz`);
        params.push(query.to);
      }
      if (query.q) {
        whereParts.push(
          `(ae.action ILIKE $${params.length + 1} OR ae.entity_type ILIKE $${params.length + 1} OR
            COALESCE(ae.entity_id, '') ILIKE $${params.length + 1} OR
            COALESCE(u.display_name, '') ILIKE $${params.length + 1} OR
            ae.details::text ILIKE $${params.length + 1})`,
        );
        params.push(`%${query.q}%`);
      }
      params.push(query.limit ?? 200);
      const result = await database.query<AuditEventRow>(
        `SELECT ae.id, ae.tenant_id, ae.actor_user_id, u.display_name AS actor_name, ae.store_id,
                ae.action, ae.entity_type, ae.entity_id, ae.details, ae.ip_address, ae.created_at
         FROM audit_events ae
         LEFT JOIN users u ON u.id = ae.actor_user_id
         WHERE ${whereParts.join(' AND ')}
         ORDER BY ae.created_at DESC
         LIMIT $${params.length}`,
        params,
      );
      return result.rows.map((row) => ({
        id: row.id,
        tenantId: row.tenant_id,
        actorUserId: row.actor_user_id ?? undefined,
        actorName: row.actor_name ?? undefined,
        storeId: row.store_id ?? undefined,
        action: row.action,
        entityType: row.entity_type,
        entityId: row.entity_id ?? undefined,
        details: parseAuditDetails(row.details),
        ipAddress: row.ip_address ?? undefined,
        createdAt: row.created_at,
      }));
    },
  );
}
