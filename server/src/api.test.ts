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

let adminHeadersPromise: Promise<{ authorization: string }> | undefined;

async function authHeaders() {
  adminHeadersPromise ??= login('admin', '1234').then(({ body: session }) => ({
    authorization: `Bearer ${session.token}`,
  }));
  return adminHeadersPromise;
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
  const [first, repeated] = await Promise.all([
    app.inject({ method: 'POST', url: '/api/sales', headers, payload }),
    app.inject({ method: 'POST', url: '/api/sales', headers, payload }),
  ]);
  assert.equal(first.statusCode, 201);
  assert.equal(repeated.statusCode, 201);
  assert.equal(repeated.json().id, first.json().id);

  const updatedProducts = await app.inject({ method: 'GET', url: '/api/products', headers });
  const updated = updatedProducts.json().find((item: { id: string }) => item.id === product.id);
  assert.equal(updated.stock, product.stock - 2);
});

test('agrupa lineas repetidas y rechaza la venta completa cuando no alcanza el stock', async () => {
  const headers = await authHeaders();
  const product = await createSaleProduct(headers);
  await ensureOpenShift(headers);

  const rejected = await app.inject({
    method: 'POST',
    url: '/api/sales',
    headers,
    payload: {
      externalId: `DUPLICATE-LINES-${Date.now()}`,
      items: [
        { id: product.id, quantity: 5 },
        { id: product.id, quantity: 4 },
      ],
      paymentMethod: 'CASH',
      amountTendered: 1000,
    },
  });
  assert.equal(rejected.statusCode, 409, rejected.body);

  const products = await app.inject({ method: 'GET', url: '/api/products', headers });
  const unchanged = products.json().find((item: { id: string }) => item.id === product.id);
  assert.equal(unchanged.stock, product.stock);
});

test('evita sobrescribir una venta concurrente al editar un producto', async () => {
  const headers = await authHeaders();
  const product = await createSaleProduct(headers);
  await ensureOpenShift(headers);

  const sold = await app.inject({
    method: 'POST',
    url: '/api/sales',
    headers,
    payload: {
      externalId: `CONCURRENT-STOCK-${Date.now()}`,
      items: [{ id: product.id, quantity: 1 }],
      paymentMethod: 'CASH',
      amountTendered: product.price,
    },
  });
  assert.equal(sold.statusCode, 201, sold.body);

  const staleUpdate = await app.inject({
    method: 'PUT',
    url: `/api/products/${product.id}`,
    headers,
    payload: {
      barcode: product.barcode,
      name: 'Nombre editado con datos obsoletos',
      category: product.category,
      cost: product.cost,
      price: product.price,
      stock: product.stock,
      expectedStock: product.stock,
      minStock: product.minStock,
    },
  });
  assert.equal(staleUpdate.statusCode, 409, staleUpdate.body);
  assert.equal(staleUpdate.json().error.code, 'INVENTORY_CHANGED', staleUpdate.body);

  const products = await app.inject({ method: 'GET', url: '/api/products', headers });
  const updated = products.json().find((item: { id: string }) => item.id === product.id);
  assert.equal(updated.stock, product.stock - 1);
  assert.equal(updated.name, product.name);
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

test('registra entradas y retiros de caja de forma idempotente', async () => {
  const headers = await authHeaders();
  const shift = await ensureOpenShift(headers);
  const before = (await app.inject({ method: 'GET', url: '/api/shifts/active', headers })).json();
  const cashInId = `CASH-IN-${Date.now()}`;
  const cashInPayload = {
    externalId: cashInId,
    type: 'CASH_IN',
    amount: 100,
    reason: 'Cambio adicional para caja',
  };

  const [cashIn, repeated] = await Promise.all([
    app.inject({
      method: 'POST',
      url: `/api/shifts/${shift.id}/cash-movements`,
      headers,
      payload: cashInPayload,
    }),
    app.inject({
      method: 'POST',
      url: `/api/shifts/${shift.id}/cash-movements`,
      headers,
      payload: cashInPayload,
    }),
  ]);
  assert.equal(cashIn.statusCode, 201, cashIn.body);
  assert.equal(repeated.statusCode, 201, repeated.body);
  assert.equal(repeated.json().id, cashIn.json().id);

  const cashOut = await app.inject({
    method: 'POST',
    url: `/api/shifts/${shift.id}/cash-movements`,
    headers,
    payload: {
      externalId: `CASH-OUT-${Date.now()}`,
      type: 'CASH_OUT',
      amount: 30,
      reason: 'Pago de mensajería',
    },
  });
  assert.equal(cashOut.statusCode, 201, cashOut.body);

  const after = (await app.inject({ method: 'GET', url: '/api/shifts/active', headers })).json();
  assert.equal(Number(after.cashIn), Number(before.cashIn) + 100);
  assert.equal(Number(after.cashOut), Number(before.cashOut) + 30);
  assert.equal(Number(after.expectedCash), Number(before.expectedCash) + 70);
  assert.equal(after.differenceThreshold, 50);

  const movements = await app.inject({
    method: 'GET',
    url: `/api/shifts/${shift.id}/cash-movements`,
    headers,
  });
  assert.equal(movements.statusCode, 200, movements.body);
  assert.equal(
    movements.json().filter((movement: { externalId: string }) => movement.externalId === cashInId)
      .length,
    1,
  );

  const invalidFraction = await app.inject({
    method: 'POST',
    url: `/api/shifts/${shift.id}/cash-movements`,
    headers,
    payload: {
      externalId: `CASH-FRACTION-${Date.now()}`,
      type: 'CASH_IN',
      amount: 0.001,
      reason: 'Fracción inválida',
    },
  });
  assert.equal(invalidFraction.statusCode, 400, invalidFraction.body);
  assert.equal(invalidFraction.json().error.code, 'VALIDATION_ERROR');
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

test('un administrador puede recuperar y cerrar una caja abandonada por otro usuario', async () => {
  const adminHeaders = await authHeaders();
  const active = await app.inject({
    method: 'GET',
    url: '/api/shifts/active',
    headers: adminHeaders,
  });
  if (active.body !== 'null') {
    const current = active.json();
    const closed = await app.inject({
      method: 'POST',
      url: `/api/shifts/${current.id}/close`,
      headers: adminHeaders,
      payload: { actualCash: current.expectedCash },
    });
    assert.equal(closed.statusCode, 200, closed.body);
  }

  const { body: cashierSession } = await login('caja1', '0000');
  const cashierHeaders = { authorization: `Bearer ${cashierSession.token}` };
  const cashierShift = await app.inject({
    method: 'POST',
    url: '/api/shifts/open',
    headers: cashierHeaders,
    payload: { initialCash: 300 },
  });
  assert.equal(cashierShift.statusCode, 201, cashierShift.body);

  const secondCashierId = randomUUID();
  await database.query(
    `INSERT INTO users (id, tenant_id, username, display_name, role, pin_hash)
     SELECT $1, tenant_id, 'caja2', 'Cajero de relevo', 'CASHIER', pin_hash
     FROM users WHERE username = 'caja1'`,
    [secondCashierId],
  );
  await database.query(
    `INSERT INTO user_store_access (user_id, store_id, is_default)
     SELECT $1, store_id, true FROM user_store_access WHERE user_id = (
       SELECT id FROM users WHERE username = 'caja1'
     )`,
    [secondCashierId],
  );
  const { body: secondCashierSession } = await login('caja2', '0000');
  const secondCashierHeaders = {
    authorization: `Bearer ${secondCashierSession.token}`,
  };
  const deniedActiveShift = await app.inject({
    method: 'GET',
    url: '/api/shifts/active',
    headers: secondCashierHeaders,
  });
  assert.equal(deniedActiveShift.statusCode, 403, deniedActiveShift.body);
  assert.equal(deniedActiveShift.json().error.code, 'SHIFT_ACCESS_DENIED');

  const deniedWithdrawal = await app.inject({
    method: 'POST',
    url: `/api/shifts/${cashierShift.json().id}/cash-movements`,
    headers: secondCashierHeaders,
    payload: {
      externalId: `DENIED-CASH-OUT-${Date.now()}`,
      type: 'CASH_OUT',
      amount: 10,
      reason: 'Intento de retiro ajeno',
    },
  });
  assert.equal(deniedWithdrawal.statusCode, 403, deniedWithdrawal.body);

  const visibleToAdmin = await app.inject({
    method: 'GET',
    url: '/api/shifts/active',
    headers: adminHeaders,
  });
  assert.equal(visibleToAdmin.statusCode, 200, visibleToAdmin.body);
  assert.equal(visibleToAdmin.json().id, cashierShift.json().id);

  const recovered = await app.inject({
    method: 'POST',
    url: `/api/shifts/${cashierShift.json().id}/close`,
    headers: adminHeaders,
    payload: { actualCash: 300 },
  });
  assert.equal(recovered.statusCode, 200, recovered.body);
  assert.equal(recovered.json().status, 'CLOSED');
});

test('siembra el catalogo de abarrotes con imagen cuando el tenant no tiene productos', async () => {
  const headers = await authHeaders();
  const response = await app.inject({ method: 'GET', url: '/api/products', headers });
  assert.equal(response.statusCode, 200);
  const products = response.json() as Array<{
    barcode: string;
    name: string;
    imageUrl?: string;
    price: number | string;
  }>;
  const catalog = products.filter((product) => product.barcode.startsWith('7501111'));
  assert.equal(catalog.length, 100);
  assert.ok(catalog.every((product) => product.imageUrl?.startsWith('/productos/genericos/')));
  const arroz = catalog.find((product) => product.barcode === '7501111000001');
  assert.equal(arroz?.name, 'Arroz blanco 1kg');
  assert.equal(Number(arroz?.price), 32);
  assert.equal(
    catalog.filter((product) => ['75010001', '75010002', '75010003'].includes(product.barcode))
      .length,
    0,
  );

  const { seedDatabase } = await import('./seed.js');
  await seedDatabase();
  const again = await app.inject({ method: 'GET', url: '/api/products', headers });
  assert.equal(
    again
      .json()
      .filter((product: { barcode: string }) => product.barcode.startsWith('7501111')).length,
    100,
  );
});
