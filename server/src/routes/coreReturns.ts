import type { FastifyInstance } from 'fastify';
import { registerSaleReturnRoute } from './coreReturnsSale.js';
import { registerSalesListAndStockRoutes } from './coreReturnsStock.js';

export function registerReturnAndStockRoutes(app: FastifyInstance) {
  registerSaleReturnRoute(app);
  registerSalesListAndStockRoutes(app);
}
