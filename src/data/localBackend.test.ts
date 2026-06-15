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
  const [product] = await backend.getStoreProducts(context);

  await assert.rejects(
    backend.processSale(context, {
      items: [cartLine(product, product.stock + 1)],
      paymentMethod: 'CASH',
      amountTendered: 10_000,
    }),
    /Stock insuficiente/,
  );

  const [unchanged] = await backend.getStoreProducts(context);
  assert.equal(unchanged.stock, product.stock);
  assert.equal((await backend.getSales(context)).length, 0);
});

test('una venta offline repetida se registra una sola vez', async () => {
  const backend = testBackend();
  const [product] = await backend.getStoreProducts(context);
  const input = {
    items: [cartLine(product, 2)],
    paymentMethod: 'CASH' as const,
    amountTendered: 100,
    externalId: 'OFF-001',
  };

  const firstSale = await backend.processSale(context, input);
  const repeatedSale = await backend.processSale(context, input);
  const [updated] = await backend.getStoreProducts(context);

  assert.equal(repeatedSale.id, firstSale.id);
  assert.equal((await backend.getSales(context)).length, 1);
  assert.equal(updated.stock, product.stock - 2);
});

test('actualiza el efectivo esperado del turno al vender en efectivo', async () => {
  const backend = testBackend();
  const [product] = await backend.getStoreProducts(context);
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
