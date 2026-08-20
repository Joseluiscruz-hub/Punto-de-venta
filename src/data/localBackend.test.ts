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
