import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { after, before, test } from 'node:test';
import type { FastifyInstance } from 'fastify';

const testDataDir = `.data/api-test-${randomUUID()}`;
process.env.NODE_ENV = 'test';
process.env.PGLITE_DATA_DIR = testDataDir;
process.env.JWT_SECRET = 'test-secret-with-at-least-thirty-two-characters';

let app: FastifyInstance;
let database: typeof import('./database.js').database;

before(async () => {
  ({ database } = await import('./database.js'));
  const [{ buildApp }, { seedDatabase }] = await Promise.all([
    import('./app.js'),
    import('./seed.js'),
  ]);
  await database.connect();
  await database.migrate();
  await seedDatabase();
  app = await buildApp();
});

after(async () => {
  await app.close();
  await database.close();
  await rm(resolve(process.cwd(), testDataDir), { recursive: true, force: true });
});

async function login(username: string, pin: string) {
  const response = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { organization: 'EL-TRIUNFO', username, pin },
  });
  assert.equal(response.statusCode, 200);
  return {
    body: response.json(),
    cookie: response.headers['set-cookie'],
  };
}

test('autentica, renueva la sesion y respeta permisos por rol', async () => {
  const admin = await login('admin', '1234');
  assert.equal(admin.body.user.role, 'ADMIN');
  assert.match(String(admin.cookie), /HttpOnly/i);

  const refresh = await app.inject({
    method: 'POST',
    url: '/api/auth/refresh',
    headers: { cookie: String(admin.cookie).split(';')[0] },
  });
  assert.equal(refresh.statusCode, 200);
  assert.ok(refresh.json().token);

  const cashier = await login('caja1', '0000');
  const forbidden = await app.inject({
    method: 'POST',
    url: '/api/products',
    headers: { authorization: `Bearer ${cashier.body.token}` },
    payload: { barcode: 'NO-PERMITIDO', name: 'Producto', category: 'Test', cost: 1, price: 2, stock: 1, minStock: 0 },
  });
  assert.equal(forbidden.statusCode, 403);
});

test('registra una venta atomica e idempotente y descuenta stock una sola vez', async () => {
  const { body: session } = await login('admin', '1234');
  const headers = { authorization: `Bearer ${session.token}` };
  const productsResponse = await app.inject({ method: 'GET', url: '/api/products', headers });
  assert.equal(productsResponse.statusCode, 200);
  const product = productsResponse.json()[0];

  const shiftResponse = await app.inject({
    method: 'POST',
    url: '/api/shifts/open',
    headers,
    payload: { initialCash: 500 },
  });
  assert.equal(shiftResponse.statusCode, 201);

  const payload = {
    externalId: 'OFF-TEST-001',
    items: [{ id: product.id, quantity: 2 }],
    paymentMethod: 'CASH',
    amountTendered: 1000,
  };
  const first = await app.inject({ method: 'POST', url: '/api/sales', headers, payload });
  const repeated = await app.inject({ method: 'POST', url: '/api/sales', headers, payload });
  assert.equal(first.statusCode, 201);
  assert.equal(repeated.statusCode, 201);
  assert.equal(repeated.json().id, first.json().id);

  const updatedProducts = await app.inject({ method: 'GET', url: '/api/products', headers });
  const updated = updatedProducts.json().find((item: { id: string }) => item.id === product.id);
  assert.equal(updated.stock, product.stock - 2);
});
