import { database } from '../database.js';
import { HttpError } from '../http.js';
import { money, type SaleRow } from '../routes/coreHelpers.js';
import {
  createCreditNoteInvoice,
  GLOBAL_LEGAL_NAME,
  GLOBAL_RFC,
  GLOBAL_TAX_SYSTEM,
  inferTaxSystem,
  isFacturapiConfigured,
  isValidCustomerRfc,
  type PaymentMethodCode,
  type SaleLineForInvoice,
} from './facturapi.js';
import {
  customerZip,
  insertInvoice,
  loadCustomer,
  loadSaleLines,
  mapInvoice,
  type InvoiceRow,
  updateSaleInvoice,
} from './records.js';

export async function createCreditNoteForReturn(
  tenantId: string,
  saleId: string,
  returnLines: SaleLineForInvoice[],
  returnTotal: number,
) {
  const saleResult = await database.query<SaleRow>(
    'SELECT * FROM sales WHERE id = $1 AND tenant_id = $2',
    [saleId, tenantId],
  );
  const sale = saleResult.rows[0];
  if (!sale) return null;
  if (sale.invoice_status !== 'STAMPED' || !sale.invoice_uuid) return null;
  if (!isFacturapiConfigured()) {
    await database.query(
      `UPDATE sales SET invoice_status = 'ERROR', invoice_error = $2 WHERE id = $1`,
      [sale.id, 'FACTURAPI_SECRET_KEY no configurada para nota de credito'],
    );
    return null;
  }

  const customer = await loadCustomer(database, tenantId, sale.customer_id);
  const taxId = isValidCustomerRfc(customer?.tax_id) ? customer!.tax_id!.trim().toUpperCase() : GLOBAL_RFC;
  const legalName = isValidCustomerRfc(customer?.tax_id) ? customer!.name : GLOBAL_LEGAL_NAME;
  const taxSystem = isValidCustomerRfc(customer?.tax_id)
    ? inferTaxSystem(customer!.tax_id!)
    : GLOBAL_TAX_SYSTEM;

  try {
    const stamped = await createCreditNoteInvoice({
      customer: {
        legal_name: legalName,
        tax_id: taxId,
        tax_system: taxSystem,
        email: customer?.email ?? undefined,
        zip: customerZip(),
      },
      items: returnLines,
      paymentMethod: sale.payment_method as PaymentMethodCode,
      relatedUuid: sale.invoice_uuid,
      externalId: `credit:${sale.id}:${Date.now()}`,
    });
    await database.transaction(async (client) => {
      await updateSaleInvoice(client, sale.id, {
        status: 'CREDIT_NOTE',
        invoiceId: stamped.id,
        invoiceUuid: stamped.uuid ?? sale.invoice_uuid,
        invoiceError: null,
        globalPeriod: sale.global_period,
      });
      await insertInvoice(client, {
        tenantId,
        storeId: sale.store_id,
        saleId: sale.id,
        kind: 'CREDIT_NOTE',
        status: 'CREDIT_NOTE',
        facturapiId: stamped.id,
        uuid: stamped.uuid ?? null,
        total: returnTotal,
      });
    });
    return stamped;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al timbrar nota de credito';
    await database.query(
      `UPDATE sales SET invoice_status = 'ERROR', invoice_error = $2 WHERE id = $1`,
      [sale.id, message.slice(0, 500)],
    );
    await insertInvoice(database, {
      tenantId,
      storeId: sale.store_id,
      saleId: sale.id,
      kind: 'CREDIT_NOTE',
      status: 'ERROR',
      error: message.slice(0, 500),
      total: returnTotal,
    });
    return null;
  }
}

export async function listInvoices(tenantId: string, storeId?: string) {
  const result = await database.query<InvoiceRow>(
    `SELECT * FROM invoices
     WHERE tenant_id = $1
       AND ($2::uuid IS NULL OR store_id = $2::uuid OR store_id IS NULL)
     ORDER BY created_at DESC
     LIMIT 200`,
    [tenantId, storeId ?? null],
  );
  return result.rows.map(mapInvoice);
}

export async function getInvoice(tenantId: string, invoiceId: string) {
  const result = await database.query<InvoiceRow>(
    'SELECT * FROM invoices WHERE id = $1 AND tenant_id = $2',
    [invoiceId, tenantId],
  );
  if (!result.rows[0]) throw new HttpError(404, 'Factura no encontrada', 'INVOICE_NOT_FOUND');
  return mapInvoice(result.rows[0]);
}

export async function createCreditNoteByInvoiceId(tenantId: string, invoiceId: string) {
  const invoice = await getInvoice(tenantId, invoiceId);
  if (!invoice.saleId) {
    throw new HttpError(400, 'Solo se puede emitir NC sobre factura de venta', 'INVALID_INVOICE');
  }
  if (invoice.status !== 'STAMPED' && invoice.kind !== 'SALE' && invoice.kind !== 'GLOBAL') {
    throw new HttpError(409, 'La factura no admite nota de credito', 'INVALID_STATUS');
  }
  const saleResult = await database.query<SaleRow>(
    'SELECT * FROM sales WHERE id = $1 AND tenant_id = $2',
    [invoice.saleId, tenantId],
  );
  const sale = saleResult.rows[0];
  if (!sale?.invoice_uuid) {
    throw new HttpError(409, 'La venta no tiene UUID fiscal', 'MISSING_UUID');
  }
  const lines = await loadSaleLines(database, sale.id);
  const stamped = await createCreditNoteForReturn(
    tenantId,
    sale.id,
    lines,
    money(sale.total) ?? 0,
  );
  if (!stamped) {
    throw new HttpError(502, 'No se pudo emitir la nota de credito', 'FACTURAPI_ERROR');
  }
  const list = await listInvoices(tenantId);
  return list.find((item) => item.facturapiId === stamped.id) ?? getInvoice(tenantId, invoiceId);
}
