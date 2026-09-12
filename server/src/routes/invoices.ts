import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authorize, parse } from '../http.js';
import { currentGlobalPeriod } from '../invoicing/facturapi.js';
import {
  createCreditNoteByInvoiceId,
  createInvoiceForSale,
  getInvoice,
  listInvoices,
  stampMonthlyGlobal,
} from '../invoicing/service.js';

const uuid = z.string().uuid();
const periodSchema = z.object({
  period: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional(),
});

export function registerInvoiceRoutes(app: FastifyInstance) {
  app.get('/invoices', async (request) => {
    const storeId =
      typeof request.headers['x-store-id'] === 'string' ? request.headers['x-store-id'] : undefined;
    return listInvoices(request.user.tenantId, storeId);
  });

  app.get('/invoices/:id', async (request) => {
    const { id } = parse(z.object({ id: uuid }), request.params);
    return getInvoice(request.user.tenantId, id);
  });

  app.post('/invoices/sale/:saleId', async (request) => {
    const { saleId } = parse(z.object({ saleId: uuid }), request.params);
    return createInvoiceForSale(request.user.tenantId, saleId, { force: true });
  });

  app.post('/invoices/global', { preHandler: authorize('ADMIN') }, async (request) => {
    const body = parse(periodSchema, request.body ?? {});
    const period = body.period ?? currentGlobalPeriod();
    const storeId =
      typeof request.headers['x-store-id'] === 'string' ? request.headers['x-store-id'] : undefined;
    return stampMonthlyGlobal(request.user.tenantId, period, storeId);
  });

  app.post(
    '/invoices/:id/credit-note',
    { preHandler: authorize('ADMIN', 'MANAGER') },
    async (request) => {
      const { id } = parse(z.object({ id: uuid }), request.params);
      return createCreditNoteByInvoiceId(request.user.tenantId, id);
    },
  );
}
