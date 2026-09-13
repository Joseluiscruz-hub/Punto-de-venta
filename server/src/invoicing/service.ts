import { database, type QueryClient } from '../database.js';
import { HttpError } from '../http.js';
import { money, saleDetails, type SaleRow } from '../routes/coreHelpers.js';
import {
  createIncomeInvoice,
  currentGlobalPeriod,
  inferTaxSystem,
  isFacturapiConfigured,
  isValidCustomerRfc,
  type PaymentMethodCode,
} from './facturapi.js';
import {
  customerZip,
  insertInvoice,
  loadCustomer,
  loadSaleLines,
  type InvoiceRecord,
  updateSaleInvoice,
} from './records.js';

export async function enqueueGlobal(
  client: QueryClient,
  sale: SaleRow,
  period = currentGlobalPeriod(new Date(sale.datetime)),
) {
  await updateSaleInvoice(client, sale.id, {
    status: 'PENDING_GLOBAL',
    invoiceId: null,
    invoiceUuid: null,
    invoiceError: null,
    globalPeriod: period,
  });
  return insertInvoice(client, {
    tenantId: sale.tenant_id,
    storeId: sale.store_id,
    saleId: sale.id,
    kind: 'GLOBAL',
    status: 'PENDING_GLOBAL',
    globalPeriod: period,
    total: money(sale.total) ?? 0,
  });
}

export async function createInvoiceForSale(
  tenantId: string,
  saleId: string,
  options: { force?: boolean } = {},
) {
  type Outcome =
    | { ok: true; invoice: InvoiceRecord; sale: Awaited<ReturnType<typeof saleDetails>> }
    | { ok: false; message: string; code: string; status: number };

  const outcome = await database.transaction(async (client): Promise<Outcome> => {
    const saleResult = await client.query<SaleRow>(
      'SELECT * FROM sales WHERE id = $1 AND tenant_id = $2 FOR UPDATE',
      [saleId, tenantId],
    );
    const sale = saleResult.rows[0];
    if (!sale) {
      return { ok: false, message: 'Venta no encontrada', code: 'SALE_NOT_FOUND', status: 404 };
    }

    if (sale.invoice_status === 'STAMPED' || sale.invoice_status === 'CREDIT_NOTE') {
      return {
        ok: false,
        message: 'La venta ya tiene CFDI timbrado',
        code: 'ALREADY_INVOICED',
        status: 409,
      };
    }
    if (!options.force && sale.invoice_status === 'PENDING_GLOBAL') {
      return {
        ok: false,
        message: 'La venta esta en cola de factura global. Usa el timbrado mensual.',
        code: 'PENDING_GLOBAL',
        status: 409,
      };
    }

    const customer = await loadCustomer(client, tenantId, sale.customer_id);
    if (!isValidCustomerRfc(customer?.tax_id)) {
      return {
        ok: false,
        message: 'El cliente no tiene un RFC valido para factura individual',
        code: 'RFC_REQUIRED',
        status: 400,
      };
    }
    if (!isFacturapiConfigured()) {
      await updateSaleInvoice(client, sale.id, {
        status: 'ERROR',
        invoiceError: 'FACTURAPI_SECRET_KEY no configurada',
        globalPeriod: null,
      });
      return {
        ok: false,
        message: 'Facturapi no esta configurado',
        code: 'FACTURAPI_NOT_CONFIGURED',
        status: 503,
      };
    }

    const lines = await loadSaleLines(client, sale.id);
    try {
      const stamped = await createIncomeInvoice({
        customer: {
          legal_name: customer!.name,
          tax_id: customer!.tax_id!.trim().toUpperCase(),
          tax_system: inferTaxSystem(customer!.tax_id!),
          email: customer!.email ?? undefined,
          zip: customerZip(),
        },
        items: lines,
        paymentMethod: sale.payment_method as PaymentMethodCode,
        externalId: `sale:${sale.id}`,
      });
      await updateSaleInvoice(client, sale.id, {
        status: 'STAMPED',
        invoiceId: stamped.id,
        invoiceUuid: stamped.uuid ?? null,
        invoiceError: null,
        globalPeriod: null,
      });
      const record = await insertInvoice(client, {
        tenantId,
        storeId: sale.store_id,
        saleId: sale.id,
        kind: 'SALE',
        status: 'STAMPED',
        facturapiId: stamped.id,
        uuid: stamped.uuid ?? null,
        total: money(sale.total) ?? 0,
      });
      const refreshed = await client.query<SaleRow>('SELECT * FROM sales WHERE id = $1', [sale.id]);
      return {
        ok: true,
        invoice: record,
        sale: await saleDetails(client, refreshed.rows[0] ?? sale),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error al timbrar CFDI';
      await updateSaleInvoice(client, sale.id, {
        status: 'ERROR',
        invoiceError: message.slice(0, 500),
        globalPeriod: null,
      });
      await insertInvoice(client, {
        tenantId,
        storeId: sale.store_id,
        saleId: sale.id,
        kind: 'SALE',
        status: 'ERROR',
        error: message.slice(0, 500),
        total: money(sale.total) ?? 0,
      });
      return { ok: false, message, code: 'FACTURAPI_ERROR', status: 502 };
    }
  });

  if (!outcome.ok) throw new HttpError(outcome.status, outcome.message, outcome.code);
  return { invoice: outcome.invoice, sale: outcome.sale };
}

export async function applyInvoiceAfterSale(tenantId: string, saleId: string) {
  const saleResult = await database.query<SaleRow>(
    'SELECT * FROM sales WHERE id = $1 AND tenant_id = $2',
    [saleId, tenantId],
  );
  const sale = saleResult.rows[0];
  if (!sale) return null;

  const customer = await loadCustomer(database, tenantId, sale.customer_id);
  if (isValidCustomerRfc(customer?.tax_id)) {
    if (!isFacturapiConfigured()) {
      return saleDetails(database, sale);
    }
    try {
      const result = await createInvoiceForSale(tenantId, saleId, { force: true });
      return result.sale;
    } catch {
      const refreshed = await database.query<SaleRow>('SELECT * FROM sales WHERE id = $1', [saleId]);
      return saleDetails(database, refreshed.rows[0] ?? sale);
    }
  }

  await database.transaction(async (client) => {
    await enqueueGlobal(client, sale);
  });
  const refreshed = await database.query<SaleRow>('SELECT * FROM sales WHERE id = $1', [saleId]);
  return saleDetails(database, refreshed.rows[0] ?? sale);
}

export { stampMonthlyGlobal } from './globalInvoice.js';
export {
  createCreditNoteForReturn,
  listInvoices,
  getInvoice,
  createCreditNoteByInvoiceId,
} from './creditNotes.js';
