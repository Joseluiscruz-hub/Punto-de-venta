import { randomUUID } from 'node:crypto';
import { database } from './database.js';
import { hashPin } from './security.js';

export const seedIds = {
  tenant: '10000000-0000-4000-8000-000000000001',
  store: '20000000-0000-4000-8000-000000000001',
  register: '30000000-0000-4000-8000-000000000001',
  admin: '40000000-0000-4000-8000-000000000001',
  cashier: '40000000-0000-4000-8000-000000000002',
};

export async function seedDatabase() {
  const existing = await database.query<{ id: string }>('SELECT id FROM tenants WHERE id = $1', [seedIds.tenant]);
  if (existing.rowCount > 0) return;

  const [adminHash, cashierHash] = await Promise.all([hashPin('1234'), hashPin('0000')]);
  await database.transaction(async (client) => {
    await client.query('INSERT INTO tenants (id, code, name, plan) VALUES ($1, $2, $3, $4)', [seedIds.tenant, 'EL-TRIUNFO', 'El Triunfo', 'PREMIUM']);
    await client.query(
      'INSERT INTO stores (id, tenant_id, code, name, address) VALUES ($1, $2, $3, $4, $5)',
      [seedIds.store, seedIds.tenant, 'SUC-001', 'Sucursal Principal', 'Domicilio provisional'],
    );
    await client.query(
      'INSERT INTO registers (id, tenant_id, store_id, code, name) VALUES ($1, $2, $3, $4, $5)',
      [seedIds.register, seedIds.tenant, seedIds.store, 'CAJA-01', 'Caja Principal'],
    );
    await client.query(
      `INSERT INTO users (id, tenant_id, username, display_name, role, pin_hash)
       VALUES ($1, $2, $3, $4, $5, $6), ($7, $2, $8, $9, $10, $11)`,
      [seedIds.admin, seedIds.tenant, 'admin', 'Administrador', 'ADMIN', adminHash,
        seedIds.cashier, 'caja1', 'Cajero Principal', 'CASHIER', cashierHash],
    );
    await client.query(
      `INSERT INTO user_store_access (user_id, store_id, is_default)
       VALUES ($1, $3, true), ($2, $3, true)`,
      [seedIds.admin, seedIds.cashier, seedIds.store],
    );

    const products = [
      ['75010001', 'Leche Entera Alpura 1L', 'Lacteos', 18.5, 25, 45, 10],
      ['75010002', 'Pan Bimbo Blanco', 'Panaderia', 30, 42, 12, 15],
      ['75010003', 'Coca-Cola 600ml', 'Bebidas', 11, 18, 120, 24],
    ] as const;

    for (const [barcode, name, category, cost, price, stock, minStock] of products) {
      const productId = randomUUID();
      await client.query(
        `INSERT INTO products (id, tenant_id, barcode, name, category, cost, price)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [productId, seedIds.tenant, barcode, name, category, cost, price],
      );
      await client.query(
        `INSERT INTO inventory (tenant_id, store_id, product_id, stock, min_stock)
         VALUES ($1, $2, $3, $4, $5)`,
        [seedIds.tenant, seedIds.store, productId, stock, minStock],
      );
    }

    await client.query(
      `INSERT INTO customers (id, tenant_id, name, points, total_spent)
       VALUES ($1, $2, $3, 0, 0), ($4, $2, $5, 150, 1250)`,
      [randomUUID(), seedIds.tenant, 'Publico General', randomUUID(), 'Cliente Frecuente'],
    );
  });
}

export async function runSeed() {
  await database.connect();
  await database.migrate();
  await seedDatabase();
  await database.close();
}
