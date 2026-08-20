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

async function authHeaders() {
  const { body: session } = await login('admin', '1234');
  return { authorization: `Bearer ${session.token}` };
}

async function ensureOpenShift(headers: { authorization: string }) {
  const active = await app.inject({ method: 'GET', url: '/api/shifts/active', headers });
  assert.equal(active.statusCode, 200);
  if (active.body !== 'null') return active.json();

  const opened = await app.inject({
    method: 'POST',
    url: '/api/shifts/open',
    headers,
    payload: { initialCash: 500 },
  });
  assert.equal(opened.statusCode, 201);
  return opened.json();
}

async function createSaleProduct(headers: { authorization: string }) {
  const response = await app.inject({
    method: 'POST',
    url: '/api/products',
    headers,
    payload: {
      barcode: `SALE-${Date.now()}-${Math.random()}`,
      name: 'Producto venta',
      category: 'Pruebas',
      cost: 10,
      price: 20,
      stock: 8,
      minStock: 1,
    },
  });
  assert.equal(response.statusCode, 201, response.body);
  return response.json();
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
    payload: {
      barcode: 'NO-PERMITIDO',
      name: 'Producto',
      category: 'Test',
      cost: 1,
      price: 2,
      stock: 1,
      minStock: 0,
    },
  });
  assert.equal(forbidden.statusCode, 403);
});

test('registra una venta atomica e idempotente y descuenta stock una sola vez', async () => {
  const headers = await authHeaders();
  const product = await createSaleProduct(headers);

  await ensureOpenShift(headers);

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

test('importa productos en bloque de forma atomica', async () => {
  const headers = await authHeaders();
  const duplicateBarcode = `BULK-DUP-${Date.now()}`;
  const failed = await app.inject({
    method: 'POST',
    url: '/api/products/bulk',
    headers,
    payload: {
      products: [
        {
          barcode: duplicateBarcode,
          name: 'Producto duplicado A',
          category: 'Test',
          cost: 1,
          price: 2,
          stock: 1,
          minStock: 0,
        },
        {
          barcode: duplicateBarcode,
          name: 'Producto duplicado B',
          category: 'Test',
          cost: 1,
          price: 2,
          stock: 1,
          minStock: 0,
        },
      ],
    },
  });
  assert.equal(failed.statusCode, 400);

  const afterFailed = await app.inject({ method: 'GET', url: '/api/products', headers });
  assert.equal(
    afterFailed.json().some((product: { barcode: string }) => product.barcode === duplicateBarcode),
    false,
  );

  const firstBarcode = `BULK-OK-${Date.now()}-1`;
  const secondBarcode = `BULK-OK-${Date.now()}-2`;
  const created = await app.inject({
    method: 'POST',
    url: '/api/products/bulk',
    headers,
    payload: {
      products: [
        {
          barcode: firstBarcode,
          name: 'Producto masivo A',
          category: 'Test',
          imageUrl: 'https://example.com/producto-masivo-a.webp',
          cost: 3,
          price: 5,
          stock: 4,
          minStock: 1,
        },
        {
          barcode: secondBarcode,
          name: 'Producto masivo B',
          category: 'Test',
          cost: 4,
          price: 6,
          stock: 5,
          minStock: 1,
        },
      ],
    },
  });
  assert.equal(created.statusCode, 201);
  assert.equal(created.json().created.length, 2);
  assert.equal(created.json().created[0].imageUrl, 'https://example.com/producto-masivo-a.webp');
});

test('distribuye un pago mixto entre efectivo y pago electronico', async () => {
  const headers = await authHeaders();
  await ensureOpenShift(headers);

  const product = await createSaleProduct(headers);
  const shiftBefore = await app.inject({ method: 'GET', url: '/api/shifts/active', headers });
  const before = shiftBefore.json();
  const cashPart = Math.max(1, Math.min(product.price - 1, 5));

  const sale = await app.inject({
    method: 'POST',
    url: '/api/sales',
    headers,
    payload: {
      externalId: `MIXED-${Date.now()}`,
      items: [{ id: product.id, quantity: 1 }],
      paymentMethod: 'MIXED',
      amountTendered: cashPart,
    },
  });
  assert.equal(sale.statusCode, 201);

  const shiftAfter = await app.inject({ method: 'GET', url: '/api/shifts/active', headers });
  const after = shiftAfter.json();
  assert.equal(Number(after.expectedCash), Number(before.expectedCash) + cashPart);
  assert.equal(Number(after.salesCash), Number(before.salesCash) + cashPart);
  assert.equal(Number(after.salesCard), Number(before.salesCard) + product.price - cashPart);
});

test('registra devoluciones parciales sin permitir devolver mas de lo vendido', async () => {
  const headers = await authHeaders();
  await ensureOpenShift(headers);
  const product = await createSaleProduct(headers);
  const createdSale = await app.inject({
    method: 'POST',
    url: '/api/sales',
    headers,
    payload: {
      externalId: `RETURN-${Date.now()}`,
      items: [{ id: product.id, quantity: 3 }],
      paymentMethod: 'CASH',
      amountTendered: 1000,
    },
  });
  assert.equal(createdSale.statusCode, 201, createdSale.body);
  const sale = createdSale.json();
  const shiftBefore = (
    await app.inject({ method: 'GET', url: '/api/shifts/active', headers })
  ).json();

  const returned = await app.inject({
    method: 'POST',
    url: `/api/sales/${sale.id}/return`,
    headers,
    payload: {
      items: [{ saleItemId: sale.items[0].id, quantity: 1 }],
      refundMethod: 'CASH',
      reason: 'Producto danado',
    },
  });
  assert.equal(returned.statusCode, 201, returned.body);
  assert.equal(returned.json().sale.returnStatus, 'PARTIAL');
  assert.equal(returned.json().sale.returnedTotal, product.price);
  assert.equal(returned.json().sale.items[0].returnedQuantity, 1);

  const productsAfterReturn = await app.inject({ method: 'GET', url: '/api/products', headers });
  const updated = productsAfterReturn.json().find((item: { id: string }) => item.id === product.id);
  assert.equal(updated.stock, product.stock - 2);

  const shiftAfter = (
    await app.inject({ method: 'GET', url: '/api/shifts/active', headers })
  ).json();
  assert.equal(Number(shiftAfter.expectedCash), Number(shiftBefore.expectedCash) - product.price);
  assert.equal(Number(shiftAfter.refundsCash), Number(shiftBefore.refundsCash) + product.price);

  const excessive = await app.inject({
    method: 'POST',
    url: `/api/sales/${sale.id}/return`,
    headers,
    payload: {
      items: [{ saleItemId: sale.items[0].id, quantity: 3 }],
      refundMethod: 'CASH',
      reason: 'Intento duplicado',
    },
  });
  assert.equal(excessive.statusCode, 409);

  const productsAfterRejected = await app.inject({ method: 'GET', url: '/api/products', headers });
  const unchanged = productsAfterRejected
    .json()
    .find((item: { id: string }) => item.id === product.id);
  assert.equal(unchanged.stock, product.stock - 2);
});

test('abona una devolucion al saldo a favor del cliente', async () => {
  const headers = await authHeaders();
  await ensureOpenShift(headers);
  const product = await createSaleProduct(headers);
  const clientsBefore = await app.inject({ method: 'GET', url: '/api/customers', headers });
  const client = clientsBefore.json().find((item: { id: string }) => item.id);
  assert.ok(client);

  const createdSale = await app.inject({
    method: 'POST',
    url: '/api/sales',
    headers,
    payload: {
      externalId: `CREDIT-RETURN-${Date.now()}`,
      items: [{ id: product.id, quantity: 1 }],
      paymentMethod: 'CARD',
      amountTendered: product.price,
      clientId: client.id,
    },
  });
  assert.equal(createdSale.statusCode, 201, createdSale.body);
  const sale = createdSale.json();

  const returned = await app.inject({
    method: 'POST',
    url: `/api/sales/${sale.id}/return`,
    headers,
    payload: {
      items: [{ saleItemId: sale.items[0].id, quantity: 1 }],
      refundMethod: 'STORE_CREDIT',
      reason: 'Cambio solicitado',
    },
  });
  assert.equal(returned.statusCode, 201, returned.body);
  assert.equal(returned.json().sale.returnStatus, 'FULL');

  const clientsAfter = await app.inject({ method: 'GET', url: '/api/customers', headers });
  const updatedClient = clientsAfter.json().find((item: { id: string }) => item.id === client.id);
  assert.equal(Number(updatedClient.storeCredit), Number(client.storeCredit) + product.price);
});
