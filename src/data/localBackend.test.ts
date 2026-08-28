import assert from 'node:assert/strict';
import test from 'node:test';
import { createLocalBackend } from './localBackend';
import type { ProductView, RequestContext } from '../models/types';

class MemoryStorage {
  private values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

const context: RequestContext = { tenantId: 't1', storeId: 's1', userId: 'u1' };
const cashierContext: RequestContext = { tenantId: 't1', storeId: 's1', userId: 'u2' };

function testBackend(storage = new MemoryStorage()) {
  let sequence = 0;
  return createLocalBackend({
    storage,
    latencyMs: 0,
    now: () => new Date('2026-06-15T12:00:00.000Z'),
    createId: (prefix) => `${prefix}-${++sequence}`,
  });
}

function cartLine(product: ProductView, quantity: number) {
  return { ...product, quantity, subtotal: product.price * quantity };
}

async function createSaleProduct(backend: ReturnType<typeof testBackend>) {
  return backend.saveProduct(context, {
    barcode: `SALE-${Date.now()}-${Math.random()}`,
    name: 'Producto venta',
    category: 'Pruebas',
    cost: 10,
    price: 20,
    stock: 6,
    minStock: 1,
  });
}

test('persiste los cambios de inventario entre instancias', async () => {
  const storage = new MemoryStorage();
  const first = testBackend(storage);
  const created = await first.saveProduct(context, {
    barcode: 'ABC-100',
    name: 'Producto persistente',
    category: 'Pruebas',
    cost: 10,
    price: 15,
    stock: 8,
    minStock: 2,
  });

  const reloaded = testBackend(storage);
  const products = await reloaded.getStoreProducts(context);
  assert.equal(products.find((product) => product.id === created.id)?.stock, 8);
});

test('rechaza una venta sin stock sin modificar el inventario', async () => {
  const backend = testBackend();
  const product = await createSaleProduct(backend);
  await backend.openShift(context, 500);

  await assert.rejects(
    backend.processSale(context, {
      items: [cartLine(product, product.stock + 1)],
      paymentMethod: 'CASH',
      amountTendered: 10_000,
    }),
    /Stock insuficiente/,
  );

  const products = await backend.getStoreProducts(context);
  const unchanged = products.find((item) => item.id === product.id);
  assert.ok(unchanged);
  assert.equal(unchanged.stock, product.stock);
  assert.equal((await backend.getSales(context)).length, 0);
});

test('una venta offline repetida se registra una sola vez', async () => {
  const backend = testBackend();
  const product = await createSaleProduct(backend);
  await backend.openShift(context, 500);
  const input = {
    items: [cartLine(product, 2)],
    paymentMethod: 'CASH' as const,
    amountTendered: 100,
    externalId: 'OFF-001',
  };

  const firstSale = await backend.processSale(context, input);
  const repeatedSale = await backend.processSale(context, input);
  const products = await backend.getStoreProducts(context);
  const updated = products.find((item) => item.id === product.id);
  assert.ok(updated);

  assert.equal(repeatedSale.id, firstSale.id);
  assert.equal((await backend.getSales(context)).length, 1);
  assert.equal(updated.stock, product.stock - 2);
});

test('actualiza el efectivo esperado del turno al vender en efectivo', async () => {
  const backend = testBackend();
  const product = await createSaleProduct(backend);
  await backend.openShift(context, 500);
  await backend.processSale(context, {
    items: [cartLine(product, 1)],
    paymentMethod: 'CASH',
    amountTendered: 100,
  });

  const shift = await backend.getActiveShift(context);
  assert.equal(shift?.salesCash, product.price);
  assert.equal(shift?.expectedCash, 500 + product.price);
});

test('registra movimientos de efectivo locales sin duplicarlos', async () => {
  const backend = testBackend();
  const shift = await backend.openShift(context, 500);
  const cashIn = {
    externalId: 'LOCAL-CASH-IN-001',
    type: 'CASH_IN' as const,
    amount: 100,
    reason: 'Cambio adicional',
  };
  const first = await backend.addCashMovement(context, shift.id, cashIn);
  const repeated = await backend.addCashMovement(context, shift.id, cashIn);
  assert.equal(repeated.id, first.id);

  await backend.addCashMovement(context, shift.id, {
    externalId: 'LOCAL-CASH-OUT-001',
    type: 'CASH_OUT',
    amount: 30,
    reason: 'Pago de mensajería',
  });

  const active = await backend.getActiveShift(context);
  assert.equal(active?.cashIn, 100);
  assert.equal(active?.cashOut, 30);
  assert.equal(active?.expectedCash, 570);
  assert.equal((await backend.getCashMovements(context, shift.id)).length, 2);

  await assert.rejects(
    backend.addCashMovement(context, shift.id, {
      externalId: 'LOCAL-CASH-FRACTION-001',
      type: 'CASH_IN',
      amount: 0.001,
      reason: 'Fracción inválida',
    }),
    /máximo dos decimales/,
  );
});

test('solo administración puede recuperar la caja de otro usuario', async () => {
  const backend = testBackend();
  const cashierShift = await backend.openShift(cashierContext, 300);
  assert.equal((await backend.getActiveShift(context))?.id, cashierShift.id);
  assert.equal((await backend.closeShift(context, 300)).status, 'CLOSED');

  await backend.openShift(context, 200);
  await assert.rejects(backend.getActiveShift(cashierContext), /otro cajero/);
});

test('rechaza una edición local con existencia obsoleta', async () => {
  const backend = testBackend();
  const product = await createSaleProduct(backend);
  await backend.openShift(context, 500);
  await backend.processSale(context, {
    items: [cartLine(product, 1)],
    paymentMethod: 'CASH',
    amountTendered: product.price,
  });

  await assert.rejects(
    backend.saveProduct(context, {
      id: product.id,
      barcode: product.barcode,
      name: 'Nombre con inventario obsoleto',
      category: product.category,
      imageUrl: product.imageUrl,
      cost: product.cost,
      price: product.price,
      stock: product.stock,
      expectedStock: product.stock,
      minStock: product.minStock,
    }),
    /La existencia cambio/,
  );

  const current = (await backend.getStoreProducts(context)).find((item) => item.id === product.id);
  assert.equal(current?.stock, product.stock - 1);
  assert.equal(current?.name, product.name);
});

test('revierte inventario y efectivo al devolver parcialmente una venta', async () => {
  const backend = testBackend();
  const product = await createSaleProduct(backend);
  await backend.openShift(context, 500);
  const sale = await backend.processSale(context, {
    items: [cartLine(product, 3)],
    paymentMethod: 'CASH',
    amountTendered: 100,
  });

  const result = await backend.returnSale(context, sale.id, {
    items: [{ saleItemId: sale.items![0].id, quantity: 1 }],
    refundMethod: 'CASH',
    reason: 'Producto danado',
  });

  assert.equal(result.sale.returnStatus, 'PARTIAL');
  assert.equal(result.sale.returnedTotal, product.price);
  assert.equal(result.sale.items?.[0].returnedQuantity, 1);
  assert.equal(
    (await backend.getStoreProducts(context)).find((item) => item.id === product.id)?.stock,
    4,
  );
  assert.equal((await backend.getActiveShift(context))?.expectedCash, 500 + product.price * 2);
  assert.equal((await backend.getActiveShift(context))?.refundsCash, product.price);

  await assert.rejects(
    backend.returnSale(context, sale.id, {
      items: [{ saleItemId: sale.items![0].id, quantity: 3 }],
      refundMethod: 'CASH',
      reason: 'Cantidad incorrecta',
    }),
    /excede las unidades disponibles/,
  );
});

test('siembra el catalogo de abarrotes con imagen en ambas sucursales', async () => {
  const backend = testBackend();
  const principal = await backend.getStoreProducts(context);
  const norte = await backend.getStoreProducts({ ...context, storeId: 's2' });
  assert.equal(principal.length, 100);
  assert.equal(norte.length, 100);
  assert.equal(principal[0].id, 'p-001');
  assert.equal(principal[99].id, 'p-100');
  assert.equal(principal[0].barcode, '7501111000001');
  assert.ok(principal.every((product) => product.imageUrl?.startsWith('/productos/genericos/')));
  const arroz = principal.find((product) => product.name === 'Arroz blanco 1kg');
  assert.equal(arroz?.cost, 22);
  assert.equal(arroz?.price, 32);
  assert.equal(arroz?.stock, 24);
  const aguacate = principal.find((product) => product.name === 'Aguacate 1kg');
  assert.equal(aguacate?.stock, 12);
  assert.equal(aguacate?.price, 78);
  assert.equal(
    principal.filter((product) => ['75010001', '75010002', '75010003'].includes(product.barcode))
      .length,
    0,
  );
});

test('migra una base local vacia insertando el catalogo una sola vez', async () => {
  const storage = new MemoryStorage();
  storage.setItem(
    'el-triunfo.database.v1',
    JSON.stringify({
      version: 1,
      tenants: [{ id: 't1', name: 'El Triunfo', plan: 'PREMIUM' }],
      stores: [
        { id: 's1', tenantId: 't1', name: 'Sucursal Principal', address: 'Centro' },
        { id: 's2', tenantId: 't1', name: 'Sucursal Norte', address: 'Norte' },
      ],
      users: [
        {
          id: 'u1',
          tenantId: 't1',
          storeId: 's1',
          username: 'admin',
          name: 'Administrador',
          role: 'ADMIN',
        },
      ],
      products: [],
      storeProducts: [],
      sales: [],
      saleItems: [],
      movements: [],
      shifts: [],
      clients: [],
    }),
  );
  const first = testBackend(storage);
  assert.equal((await first.getStoreProducts(context)).length, 100);
  const second = testBackend(storage);
  assert.equal((await second.getStoreProducts(context)).length, 100);
  assert.equal((await second.getStoreProducts({ ...context, storeId: 's2' })).length, 100);
});

test('no reemplaza un catalogo local que ya tiene productos', async () => {
  const storage = new MemoryStorage();
  storage.setItem(
    'el-triunfo.database.v1',
    JSON.stringify({
      version: 1,
      tenants: [{ id: 't1', name: 'El Triunfo', plan: 'PREMIUM' }],
      stores: [{ id: 's1', tenantId: 't1', name: 'Sucursal Principal', address: 'Centro' }],
      users: [
        {
          id: 'u1',
          tenantId: 't1',
          storeId: 's1',
          username: 'admin',
          name: 'Administrador',
          role: 'ADMIN',
        },
      ],
      products: [
        {
          id: 'existing',
          tenantId: 't1',
          barcode: '99900001',
          name: 'Producto propio',
          category: 'Pruebas',
          cost: 1,
          price: 2,
        },
      ],
      storeProducts: [
        {
          id: 'sp-existing',
          tenantId: 't1',
          storeId: 's1',
          productId: 'existing',
          stock: 3,
          minStock: 1,
        },
      ],
      sales: [],
      saleItems: [],
      movements: [],
      shifts: [],
      clients: [],
    }),
  );
  const products = await testBackend(storage).getStoreProducts(context);
  assert.equal(products.length, 1);
  assert.equal(products[0].id, 'existing');
});
