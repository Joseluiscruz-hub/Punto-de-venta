import { database } from '../database.js';
import { HttpError } from '../http.js';
import { money, type SaleRow } from '../routes/coreHelpers.js';
import {
  createIncomeInvoice,
  GLOBAL_LEGAL_NAME,
  GLOBAL_RFC,
  GLOBAL_TAX_SYSTEM,
  isFacturapiConfigured,
  periodParts,
  type PaymentMethodCode,
  type SaleLineForInvoice,
} from './facturapi.js';
import {
  customerZip,
  insertInvoice,
  loadSaleLines,
  type InvoiceRecord,
  updateSaleInvoice,
} from './records.js';

export async function stampMonthlyGlobal(tenantId: string, period: string, storeId?: string) {
  const { year, months } = periodParts(period);
  if (!isFacturapiConfigured()) {
    throw new HttpError(503, 'Facturapi no esta configurado', 'FACTURAPI_NOT_CONFIGURED');
  }

  const result = await database.transaction(async (client) => {
    const pending = await client.query<SaleRow>(
      `SELECT * FROM sales
       WHERE tenant_id = $1
         AND invoice_status = 'PENDING_GLOBAL'
         AND global_period = $2
         AND ($3::uuid IS NULL OR store_id = $3::uuid)
       ORDER BY datetime
       FOR UPDATE`,
      [tenantId, period, storeId ?? null],
    );
    if (pending.rowCount === 0) {
      throw new HttpError(404, 'No hay ventas pendientes para el periodo', 'NO_PENDING_SALES');
    }

    const lines: SaleLineForInvoice[] = [];
    let total = 0;
    let paymentMethod: PaymentMethodCode = 'CASH';
    for (const sale of pending.rows) {
      const saleLines = await loadSaleLines(client, sale.id);
      lines.push(...saleLines);
      total += money(sale.total) ?? 0;
      paymentMethod = sale.payment_method as PaymentMethodCode;
    }

    try {
      const stamped = await createIncomeInvoice({
        customer: {
          legal_name: GLOBAL_LEGAL_NAME,
          tax_id: GLOBAL_RFC,
          tax_system: GLOBAL_TAX_SYSTEM,
          zip: customerZip(),
        },
        items: lines,
        paymentMethod,
        use: 'S01',
        externalId: `global:${tenantId}:${period}`,
        global: { periodicity: 'month', months, year },
      });

      for (const sale of pending.rows) {
        await updateSaleInvoice(client, sale.id, {
          status: 'STAMPED',
          invoiceId: stamped.id,
          invoiceUuid: stamped.uuid ?? null,
          invoiceError: null,
          globalPeriod: period,
        });
      }

      const record = await insertInvoice(client, {
        tenantId,
        storeId: storeId ?? pending.rows[0]?.store_id,
        kind: 'GLOBAL',
        status: 'STAMPED',
        facturapiId: stamped.id,
        uuid: stamped.uuid ?? null,
        globalPeriod: period,
        total,
      });
      return { invoice: record, salesCount: pending.rowCount };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error al timbrar factura global';
      await insertInvoice(client, {
        tenantId,
        storeId: storeId ?? pending.rows[0]?.store_id,
        kind: 'GLOBAL',
        status: 'ERROR',
        error: message.slice(0, 500),
        globalPeriod: period,
        total,
      });
      return { invoice: null as unknown as InvoiceRecord, salesCount: 0, error: message };
    }
  });
  if ('error' in result && result.error) {
    throw new HttpError(502, result.error, 'FACTURAPI_ERROR');
  }
  return { invoice: result.invoice, salesCount: result.salesCount };
}
