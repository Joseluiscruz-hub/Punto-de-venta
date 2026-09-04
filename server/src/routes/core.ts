import type { FastifyInstance } from 'fastify';
import { authenticate } from '../http.js';
import { registerAuditRoutes } from './auditEvents.js';
import { registerCatalogRoutes } from './coreCatalog.js';
import { registerShiftRoutes } from './coreShifts.js';
import { registerSalesRoutes } from './coreSales.js';

export async function coreRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);
  registerCatalogRoutes(app);
  registerShiftRoutes(app);
  registerSalesRoutes(app);
  registerAuditRoutes(app);
}
