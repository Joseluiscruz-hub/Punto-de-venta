import { randomUUID } from 'node:crypto';
import type { QueryClient } from '../database.js';
import { config } from '../config.js';
import { money } from '../routes/coreHelpers.js';
import { getInvoiceUrls, type SaleLineForInvoice } from './facturapi.js';

export type InvoiceStatus = 'NONE' | 'PENDING_GLOBAL' | 'STAMPED' | 'ERROR' | 'CREDIT_NOTE';
export type InvoiceKind = 'SALE' | 'GLOBAL' | 'CREDIT_NOTE';

export type InvoiceRecord = {
  id: string;
  tenantId: string;
  storeId?: string;
  saleId?: string;
  kind: InvoiceKind;
  status: InvoiceStatus;
  facturapiId?: string;
  uuid?: string;
  globalPeriod?: string;
  error?: string;
  total: number;
  paymentForm?: string;
  pdfUrl?: string;
  xmlUrl?: string;
  createdAt: string;
  updatedAt: string;
};

export type InvoiceRow = {
  id: string;
  tenant_id: string;
  store_id: string | null;
  sale_id: string | null;
  kind: InvoiceKind;
  status: InvoiceStatus;
  facturapi_id: string | null;
  uuid: string | null;
  global_period: string | null;
  error: string | null;
  total: string | number;
  payment_form: string | null;
  created_at: string;
  updated_at: string;
};

type CustomerFiscal = {
  id: string;
  name: string;
  email: string | null;
  tax_id: string | null;
};

export function customerZip() {
  return config.FACTURAPI_DEFAULT_ZIP?.trim() || '06600';
}

export function mapInvoice(row: InvoiceRow): InvoiceRecord {
  const urls = row.facturapi_id ? getInvoiceUrls(row.facturapi_id) : {};
  return {
    id: row.id,
    tenantId: row.tenant_id,
    storeId: row.store_id ?? undefined,
    saleId: row.sale_id ?? undefined,
    kind: row.kind,
    status: row.status,
    facturapiId: row.facturapi_id ?? undefined,
    uuid: row.uuid ?? undefined,
    globalPeriod: row.global_period ?? undefined,
    error: row.error ?? undefined,
    total: money(row.total) ?? 0,
    paymentForm: row.payment_form ?? undefined,
    pdfUrl: urls.pdfUrl,
    xmlUrl: urls.xmlUrl,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function updateSaleInvoice(
  client: QueryClient,
  saleId: string,
  fields: {
    status: InvoiceStatus;
    invoiceId?: string | null;
    invoiceUuid?: string | null;
    invoiceError?: string | null;
    globalPeriod?: string | null;
  },
) {
  await client.query(
    `UPDATE sales
     SET invoice_status = $2,
         invoice_id = $3,
         invoice_uuid = $4,
         invoice_error = $5,
         global_period = $6
     WHERE id = $1`,
    [
      saleId,
      fields.status,
      fields.invoiceId ?? null,
      fields.invoiceUuid ?? null,
      fields.invoiceError ?? null,
      fields.globalPeriod ?? null,
    ],
  );
}

export async function insertInvoice(
  client: QueryClient,
  input: {
    tenantId: string;
    storeId?: string | null;
    saleId?: string | null;
    kind: InvoiceKind;
    status: InvoiceStatus;
    facturapiId?: string | null;
    uuid?: string | null;
    globalPeriod?: string | null;
    error?: string | null;
    total: number;
    paymentForm?: string | null;
    relatedInvoiceId?: string | null;
  },
) {
  const id = randomUUID();
  const result = await client.query<InvoiceRow>(
    `INSERT INTO invoices
      (id, tenant_id, store_id, sale_id, kind, status, facturapi_id, uuid, global_period,
       error, total, payment_form, related_invoice_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     RETURNING *`,
    [
      id,
      input.tenantId,
      input.storeId ?? null,
      input.saleId ?? null,
      input.kind,
      input.status,
      input.facturapiId ?? null,
      input.uuid ?? null,
      input.globalPeriod ?? null,
      input.error ?? null,
      input.total,
      input.paymentForm ?? null,
      input.relatedInvoiceId ?? null,
    ],
  );
  return mapInvoice(result.rows[0]!);
}

export async function loadSaleLines(client: QueryClient, saleId: string): Promise<SaleLineForInvoice[]> {
  const items = await client.query<{ product_name: string; quantity: number; price: string | number }>(
    `SELECT product_name, quantity, price FROM sale_items WHERE sale_id = $1 ORDER BY id`,
    [saleId],
  );
  return items.rows.map((item) => ({
    name: item.product_name,
    quantity: item.quantity,
    price: money(item.price) ?? 0,
  }));
}

export async function loadCustomer(
  client: QueryClient,
  tenantId: string,
  customerId: string | null,
): Promise<CustomerFiscal | null> {
  if (!customerId) return null;
  const result = await client.query<CustomerFiscal>(
    'SELECT id, name, email, tax_id FROM customers WHERE id = $1 AND tenant_id = $2',
    [customerId, tenantId],
  );
  return result.rows[0] ?? null;
}
