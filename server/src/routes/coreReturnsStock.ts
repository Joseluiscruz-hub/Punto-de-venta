import type { FastifyInstance } from 'fastify';
import { database } from '../database.js';
import { resolveStoreContext } from '../http.js';
import { saleDetails, type SaleRow } from './coreHelpers.js';

export function registerSalesListAndStockRoutes(app: FastifyInstance) {
  app.get('/sales', async (request) => {
    const context = await resolveStoreContext(request, database);
    const result = await database.query(
      'SELECT * FROM sales WHERE tenant_id = $1 AND store_id = $2 ORDER BY datetime DESC LIMIT 500',
      [request.user.tenantId, context.storeId],
    );
    return Promise.all(result.rows.map((sale) => saleDetails(database, sale as SaleRow)));
  });

  app.get('/stock-movements', async (request) => {
    const context = await resolveStoreContext(request, database);
    const result = await database.query(
      `SELECT m.id, m.tenant_id, m.store_id, m.product_id, m.user_id, m.type, m.quantity,
              m.date, m.reason, p.name AS product_name, u.display_name AS user_name
       FROM stock_movements m
       JOIN products p ON p.id = m.product_id
       JOIN users u ON u.id = m.user_id
       WHERE m.tenant_id = $1 AND m.store_id = $2 ORDER BY m.date DESC LIMIT 1000`,
      [request.user.tenantId, context.storeId],
    );
    return result.rows.map((row) => {
      const r = row as {
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
      };
      return {
        id: r.id,
        tenantId: r.tenant_id,
        storeId: r.store_id,
        productId: r.product_id,
        userId: r.user_id,
        type: r.type,
        quantity: r.quantity,
        date: r.date,
        reason: r.reason,
        productName: r.product_name,
        userName: r.user_name,
      };
    });
  });
}
