import { database } from './database.js';
import { config } from './config.js';
import { hashPin } from './security.js';
import { catalogProductUuid, loadAbarrotesCatalog } from './abarrotesCatalog.js';

export const seedIds = {
  tenant: '10000000-0000-4000-8000-000000000001',
  store: '20000000-0000-4000-8000-000000000001',
  register: '30000000-0000-4000-8000-000000000001',
  admin: '40000000-0000-4000-8000-000000000001',
  cashier: '40000000-0000-4000-8000-000000000002',
};


async function seedAbarrotesCatalogIfEmpty(tenantId: string) {
  const existingProducts = await database.query<{ id: string }>(
    'SELECT id FROM products WHERE tenant_id = $1 LIMIT 1',
    [tenantId],
  );
  if (existingProducts.rowCount > 0) return;

  const stores = await database.query<{ id: string }>(
    'SELECT id FROM stores WHERE tenant_id = $1',
    [tenantId],
  );
  if (stores.rowCount === 0) return;

  const catalog = loadAbarrotesCatalog();
  await database.transaction(async (client) => {
    const stillEmpty = await client.query<{ id: string }>(
      'SELECT id FROM products WHERE tenant_id = $1 LIMIT 1',
      [tenantId],
    );
    if (stillEmpty.rowCount > 0) return;

    const productSql =
      'INSERT INTO products (id, tenant_id, barcode, name, category, image_url, cost, price, active) ' +
      'VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)';
    const inventorySql =
      'INSERT INTO inventory (tenant_id, store_id, product_id, stock, min_stock) ' +
      'VALUES ($1, $2, $3, $4, $5)';

    for (const item of catalog) {
      const productId = catalogProductUuid(item.id);
      await client.query(productSql, [
        productId,
        tenantId,
        item.barcode,
        item.name,
        item.category,
        item.imageUrl,
        item.cost,
        item.price,
      ]);
      for (const store of stores.rows) {
        await client.query(inventorySql, [
          tenantId,
          store.id,
          productId,
          item.stock,
          item.minStock,
        ]);
      }
    }
  });
}


export async function seedDatabase() {
  const existing = await database.query<{ id: string }>('SELECT id FROM tenants WHERE id = $1', [
    seedIds.tenant,
  ]);
  if (existing.rowCount === 0) {
    const adminPin = config.SEED_ADMIN_PIN ?? (config.isProduction ? undefined : '1234');
    const cashierPin = config.SEED_CASHIER_PIN ?? (config.isProduction ? undefined : '0000');
    if (!adminPin || !cashierPin) {
      throw new Error(
        'SEED_ADMIN_PIN and SEED_CASHIER_PIN are required to initialize an empty production database',
      );
    }
    const [adminHash, cashierHash] = await Promise.all([hashPin(adminPin), hashPin(cashierPin)]);
    await database.transaction(async (client) => {
      await client.query('INSERT INTO tenants (id, code, name, plan) VALUES ($1, $2, $3, $4)', [
        seedIds.tenant,
        'EL-TRIUNFO',
        'El Triunfo',
        'PREMIUM',
      ]);
      await client.query(
        'INSERT INTO stores (id, tenant_id, code, name, address) VALUES ($1, $2, $3, $4, $5)',
        [seedIds.store, seedIds.tenant, 'SUC-001', 'Sucursal Principal', 'Domicilio provisional'],
      );
      await client.query(
        'INSERT INTO registers (id, tenant_id, store_id, code, name) VALUES ($1, $2, $3, $4, $5)',
        [seedIds.register, seedIds.tenant, seedIds.store, 'CAJA-01', 'Caja Principal'],
      );
      await client.query(
        'INSERT INTO users (id, tenant_id, username, display_name, role, pin_hash) VALUES ($1, $2, $3, $4, $5, $6), ($7, $2, $8, $9, $10, $11)',
        [
          seedIds.admin,
          seedIds.tenant,
          'admin',
          'Administrador',
          'ADMIN',
          adminHash,
          seedIds.cashier,
          'caja1',
          'Cajero Principal',
          'CASHIER',
          cashierHash,
        ],
      );
      await client.query(
        'INSERT INTO user_store_access (user_id, store_id, is_default) VALUES ($1, $3, true), ($2, $3, true)',
        [seedIds.admin, seedIds.cashier, seedIds.store],
      );
      await client.query(
        'INSERT INTO customers (id, tenant_id, name, points, total_spent) VALUES ($1, $2, $3, 0, 0), ($4, $2, $5, 150, 1250)',
        [
          '50000000-0000-4000-8000-000000000001',
          seedIds.tenant,
          'Publico General',
          '50000000-0000-4000-8000-000000000002',
          'Cliente Frecuente',
        ],
      );
    });
  }

  await seedAbarrotesCatalogIfEmpty(seedIds.tenant);
}

export async function runSeed() {
  await database.connect();
  await database.migrate();
  await seedDatabase();
  await database.close();
}
