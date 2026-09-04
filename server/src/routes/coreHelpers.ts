import type { FastifyRequest } from 'fastify';
import { z } from 'zod';
import { config } from '../config.js';
import type { QueryClient } from '../database.js';
import { HttpError } from '../http.js';

export const uuid = z.string().uuid();
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
export const productSchema = z.object({
  barcode: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(200),
  category: z.string().trim().min(1).max(100),
  imageUrl: imageUrlSchema,
  cost: z.coerce.number().min(0).max(99_999_999),
  price: z.coerce.number().min(0).max(99_999_999),
  stock: z.coerce.number().int().min(0).max(99_999_999),
  minStock: z.coerce.number().int().min(0).max(99_999_999),
});
export const updateProductSchema = productSchema.extend({
  expectedStock: z.coerce.number().int().min(0).max(99_999_999),
});
export const productsBulkSchema = z.object({
  products: z.array(productSchema).min(1).max(1000),
});
export const customerSchema = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().email().max(200).optional().or(z.literal('')),
  phone: z.string().trim().max(30).optional(),
  taxId: z.string().trim().max(30).optional(),
});
export const saleSchema = z.object({
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
export const returnSaleSchema = z.object({
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
export const cashMovementSchema = z.object({
  externalId: z.string().trim().min(1).max(100),
  type: z.enum(['CASH_IN', 'CASH_OUT']),
  amount: z.coerce
    .number()
    .positive()
    .max(99_999_999)
    .refine((value) => roundMoney(value) === value, 'El monto admite como máximo dos decimales'),
  reason: z.string().trim().min(3).max(300),
});

export interface ProductRow {
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

export interface CustomerRow {
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

export interface ShiftRow {
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
  sales_count?: string | number;
}

export interface CashMovementRow {
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

export interface SaleRow {
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

export interface SaleItemRow {
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

export interface SaleReturnRow {
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

export interface SaleReturnItemRow {
  id: string;
  return_id: string;
  sale_item_id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  price: string | number;
  subtotal: string | number;
}

export const money = (value: string | number | null) => (value === null ? undefined : Number(value));
export const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const genericDemoProductNames = new Map([
  ['Leche Entera Alpura 1L', 'Leche entera 1L'],
  ['Pan Bimbo Blanco', 'Pan blanco 680g'],
  ['Coca-Cola 600ml', 'Refresco cola 600ml'],
]);

function genericProductName(name: string) {
  return genericDemoProductNames.get(name) ?? name;
}

export function mapProduct(row: ProductRow) {
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

export function mapCustomer(row: CustomerRow) {
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

export function mapShift(row: ShiftRow) {
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
    salesCount: Number(row.sales_count ?? 0),
    differenceThreshold: config.CASH_DIFFERENCE_THRESHOLD,
  };
}

export function mapCashMovement(row: CashMovementRow) {
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

export function canOperateShift(request: FastifyRequest, shift: ShiftRow) {
  return (
    shift.user_id === request.user.sub ||
    request.user.role === 'ADMIN' ||
    request.user.role === 'MANAGER'
  );
}

export function assertCanOperateShift(request: FastifyRequest, shift: ShiftRow) {
  if (!canOperateShift(request, shift)) {
    throw new HttpError(
      403,
      'La caja está abierta por otro cajero. Solicita apoyo de un administrador o gerente.',
      'SHIFT_ACCESS_DENIED',
    );
  }
}

export function assertSaleReplayScope(
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

export function assertCashMovementReplayScope(
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

export async function saleDetails(client: QueryClient, sale: SaleRow) {
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

export async function productRows(client: QueryClient, tenantId: string, storeId: string) {
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
