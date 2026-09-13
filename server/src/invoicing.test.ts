import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { after, before, test } from 'node:test';
import type { FastifyInstance } from 'fastify';

const testDataDir = `.data/invoicing-test-${randomUUID()}`;
process.env.NODE_ENV = 'test';
process.env.PGLITE_DATA_DIR = testDataDir;
process.env.JWT_SECRET = 'test-secret-with-at-least-thirty-two-characters';
process.env.FACTURAPI_SECRET_KEY = 'sk_test_mock_key_for_unit_tests';
process.env.FACTURAPI_DEFAULT_ZIP = '06600';

let app: FastifyInstance;
let database: typeof import('./database.js').database;
let createCalls: Record<string, unknown>[] = [];

before(async () => {
  ({ database } = await import('./database.js'));
  const { setFacturapiClientForTests } = await import('./invoicing/facturapi.js');
  setFacturapiClientForTests({
    invoices: {
      async create(payload) {
        createCalls.push(payload);
        return {
          id: `inv_${createCalls.length}`,
          uuid: `00000000-0000-4000-8000-${String(createCalls.length).padStart(12, '0')}`,
          status: 'valid',
        };
      },
    },
  });
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
  const { setFacturapiClientForTests } = await import('./invoicing/facturapi.js');
  setFacturapiClientForTests(null);
  await app.close();
  await database.close();
  await rm(resolve(process.cwd(), testDataDir), { recursive: true, force: true });
});

async function login() {
  const response = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { organization: 'EL-TRIUNFO', username: 'admin', pin: '1234' },
  });
  assert.equal(response.statusCode, 200);
  return { authorization: `Bearer ${response.json().token}` };
}

async function ensureShift(headers: { authorization: string }) {
  const active = await app.inject({ method: 'GET', url: '/api/shifts/active', headers });
  if (active.body !== 'null') return;
  const opened = await app.inject({
    method: 'POST',
    url: '/api/shifts/open',
    headers,
    payload: { initialCash: 500 },
  });
  assert.equal(opened.statusCode, 201, opened.body);
}

async function product(headers: { authorization: string }) {
  const response = await app.inject({
    method: 'POST',
    url: '/api/products',
    headers,
    payload: {
      barcode: `CFDI-${Date.now()}-${Math.random()}`,
      name: 'Producto CFDI',
      category: 'Pruebas',
      cost: 10,
      price: 116,
      stock: 20,
      minStock: 1,
    },
  });
  assert.equal(response.statusCode, 201, response.body);
  return response.json();
}

test('venta con RFC valido llama a Facturapi create y queda STAMPED', async () => {
  createCalls = [];
  const headers = await login();
  await ensureShift(headers);
  const item = await product(headers);

  const customer = await app.inject({
    method: 'POST',
    url: '/api/customers',
    headers,
    payload: {
      name: 'Cliente Factura SA',
      taxId: 'ABC010101ABC',
      email: 'cfdi@example.com',
    },
  });
  assert.equal(customer.statusCode, 201, customer.body);

  const before = createCalls.length;
  const sale = await app.inject({
    method: 'POST',
    url: '/api/sales',
    headers,
    payload: {
      externalId: `CFDI-RFC-${Date.now()}`,
      items: [{ id: item.id, quantity: 1 }],
      paymentMethod: 'CASH',
      amountTendered: 200,
      clientId: customer.json().id,
    },
  });
  assert.equal(sale.statusCode, 201, sale.body);
  assert.equal(sale.json().invoiceStatus, 'STAMPED');
  assert.ok(sale.json().invoiceUuid);
  assert.equal(createCalls.length, before + 1);
  assert.equal((createCalls.at(-1) as { type?: string }).type, undefined);
  assert.equal((createCalls.at(-1) as { use: string }).use, 'G01');
});

test('venta sin RFC no llama a Facturapi y queda PENDING_GLOBAL', async () => {
  createCalls = [];
  const headers = await login();
  await ensureShift(headers);
  const item = await product(headers);
  const before = createCalls.length;

  const sale = await app.inject({
    method: 'POST',
    url: '/api/sales',
    headers,
    payload: {
      externalId: `CFDI-GLOBAL-${Date.now()}`,
      items: [{ id: item.id, quantity: 1 }],
      paymentMethod: 'CARD',
      amountTendered: 116,
    },
  });
  assert.equal(sale.statusCode, 201, sale.body);
  assert.equal(sale.json().invoiceStatus, 'PENDING_GLOBAL');
  assert.match(String(sale.json().globalPeriod), /^\d{4}-\d{2}$/);
  assert.equal(createCalls.length, before);
});

test('devolucion de venta STAMPED crea CFDI de egreso', async () => {
  createCalls = [];
  const headers = await login();
  await ensureShift(headers);
  const item = await product(headers);
  const fiscal = await app.inject({
    method: 'POST',
    url: '/api/customers',
    headers,
    payload: { name: 'Cliente NC SA', taxId: 'DEF010101DEF', email: 'nc@example.com' },
  });
  assert.equal(fiscal.statusCode, 201, fiscal.body);

  const saleRes = await app.inject({
    method: 'POST',
    url: '/api/sales',
    headers,
    payload: {
      externalId: `CFDI-NC-${Date.now()}`,
      items: [{ id: item.id, quantity: 2 }],
      paymentMethod: 'TRANSFER',
      amountTendered: 232,
      clientId: fiscal.json().id,
    },
  });
  assert.equal(saleRes.statusCode, 201, saleRes.body);
  assert.equal(saleRes.json().invoiceStatus, 'STAMPED');
  const sale = saleRes.json();
  const beforeNc = createCalls.length;

  const returned = await app.inject({
    method: 'POST',
    url: `/api/sales/${sale.id}/return`,
    headers,
    payload: {
      items: [{ saleItemId: sale.items[0].id, quantity: 1 }],
      refundMethod: 'CASH',
      reason: 'Producto defectuoso',
    },
  });
  assert.equal(returned.statusCode, 201, returned.body);
  assert.equal(createCalls.length, beforeNc + 1);
  const payload = createCalls.at(-1) as {
    type: string;
    related_documents: Array<{ relationship: string; documents: string[] }>;
  };
  assert.equal(payload.type, 'E');
  assert.equal(payload.related_documents[0]?.relationship, '01');
  assert.equal(returned.json().sale.invoiceStatus, 'CREDIT_NOTE');
});
