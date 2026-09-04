import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  audit,
  authorize,
  HttpError,
  parse,
  resolveStoreContext,
} from '../http.js';
import { database } from '../database.js';
import {
  uuid,
  productSchema,
  updateProductSchema,
  productsBulkSchema,
  customerSchema,
  mapProduct,
  mapCustomer,
  productRows,
  type CustomerRow,
} from './coreHelpers.js';

export function registerCatalogRoutes(app: FastifyInstance) {
  app.get('/stores', async (request) => {
    const result = await database.query<{
      id: string;
      tenant_id: string;
      name: string;
      address: string;
      code: string;
    }>(
      `SELECT s.id, s.tenant_id, s.code, s.name, s.address
       FROM stores s JOIN user_store_access usa ON usa.store_id = s.id
       WHERE usa.user_id = $1 AND s.tenant_id = $2 AND s.active = true ORDER BY s.code`,
      [request.user.sub, request.user.tenantId],
    );
    return result.rows.map((row) => ({
      id: row.id,
      tenantId: row.tenant_id,
      code: row.code,
      name: row.name,
      address: row.address,
    }));
  });

  app.get('/registers', async (request) => {
    const query = parse(z.object({ storeId: uuid.optional() }), request.query);
    const storeId = query.storeId ?? request.user.storeId;
    const access = await database.query<{ id: string }>(
      'SELECT store_id AS id FROM user_store_access WHERE user_id = $1::uuid AND store_id = $2::uuid',
      [request.user.sub, storeId],
    );
    if (access.rowCount === 0)
      throw new HttpError(403, 'No tienes acceso a esta sucursal', 'STORE_ACCESS_DENIED');
    const registers = await database.query<{
      id: string;
      store_id: string;
      code: string;
      name: string;
    }>(
      'SELECT id, store_id, code, name FROM registers WHERE store_id = $1 AND active = true ORDER BY code',
      [storeId],
    );
    return registers.rows.map((row) => ({
      id: row.id,
      storeId: row.store_id,
      code: row.code,
      name: row.name,
    }));
  });

  app.get('/products', async (request) => {
    const context = await resolveStoreContext(request, database);
    const result = await productRows(database, request.user.tenantId, context.storeId);
    return result.rows.map(mapProduct);
  });

  app.post('/products', { preHandler: authorize('ADMIN', 'MANAGER') }, async (request, reply) => {
    const input = parse(productSchema, request.body);
    const created = await database.transaction(async (client) => {
      const context = await resolveStoreContext(request, client);
      const productId = randomUUID();
      await client.query(
        `INSERT INTO products (id, tenant_id, barcode, name, category, image_url, cost, price)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          productId,
          request.user.tenantId,
          input.barcode,
          input.name,
          input.category,
          input.imageUrl ?? null,
          input.cost,
          input.price,
        ],
      );
      await client.query(
        `INSERT INTO inventory (tenant_id, store_id, product_id, stock, min_stock)
         VALUES ($1, $2, $3, $4, $5)`,
        [request.user.tenantId, context.storeId, productId, input.stock, input.minStock],
      );
      if (input.stock > 0) {
        await client.query(
          `INSERT INTO stock_movements
            (id, tenant_id, store_id, product_id, user_id, type, quantity, reason)
           VALUES ($1, $2, $3, $4, $5, 'PURCHASE', $6, 'Inventario inicial')`,
          [
            randomUUID(),
            request.user.tenantId,
            context.storeId,
            productId,
            request.user.sub,
            input.stock,
          ],
        );
      }
      await audit(client, request, 'PRODUCT_CREATED', 'product', productId, {
        barcode: input.barcode,
      });
      const products = await productRows(client, request.user.tenantId, context.storeId);
      const product = products.rows.find((row) => row.id === productId);
      if (!product) throw new HttpError(500, 'No se pudo recuperar el producto creado');
      return mapProduct(product);
    });
    return reply.status(201).send(created);
  });

  app.post(
    '/products/bulk',
    { preHandler: authorize('ADMIN', 'MANAGER') },
    async (request, reply) => {
      const input = parse(productsBulkSchema, request.body);
      const created = await database.transaction(async (client) => {
        const context = await resolveStoreContext(request, client);
        const seen = new Set<string>();
        for (const product of input.products) {
          if (seen.has(product.barcode)) {
            throw new HttpError(
              400,
              `El archivo contiene codigos repetidos: ${product.barcode}`,
              'DUPLICATE_IMPORT_BARCODE',
            );
          }
          seen.add(product.barcode);
        }

        for (const product of input.products) {
          const duplicate = await client.query<{ id: string }>(
            'SELECT id FROM products WHERE tenant_id = $1 AND barcode = $2 LIMIT 1',
            [request.user.tenantId, product.barcode],
          );
          if (duplicate.rowCount > 0) {
            throw new HttpError(
              409,
              `Ya existe un producto con el codigo ${product.barcode}`,
              'DUPLICATE_RECORD',
            );
          }
        }

        const createdProducts: Array<ReturnType<typeof mapProduct>> = [];
        for (const product of input.products) {
          const productId = randomUUID();
          await client.query(
            `INSERT INTO products (id, tenant_id, barcode, name, category, image_url, cost, price)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
              productId,
              request.user.tenantId,
              product.barcode,
              product.name,
              product.category,
              product.imageUrl ?? null,
              product.cost,
              product.price,
            ],
          );
          await client.query(
            `INSERT INTO inventory (tenant_id, store_id, product_id, stock, min_stock)
             VALUES ($1, $2, $3, $4, $5)`,
            [request.user.tenantId, context.storeId, productId, product.stock, product.minStock],
          );
          if (product.stock > 0) {
            await client.query(
              `INSERT INTO stock_movements
                (id, tenant_id, store_id, product_id, user_id, type, quantity, reason)
               VALUES ($1, $2, $3, $4, $5, 'PURCHASE', $6, 'Importacion inicial')`,
              [
                randomUUID(),
                request.user.tenantId,
                context.storeId,
                productId,
                request.user.sub,
                product.stock,
              ],
            );
          }
          createdProducts.push({
            id: productId,
            tenantId: request.user.tenantId,
            barcode: product.barcode,
            name: product.name,
            category: product.category,
            imageUrl: product.imageUrl,
            cost: product.cost,
            price: product.price,
            stock: product.stock,
            minStock: product.minStock,
          });
        }

        await audit(client, request, 'PRODUCTS_BULK_IMPORTED', 'product_import', undefined, {
          count: createdProducts.length,
        });
        return createdProducts;
      });
      return reply.status(201).send({ created });
    },
  );

  app.put('/products/:id', { preHandler: authorize('ADMIN', 'MANAGER') }, async (request) => {
    const { id } = parse(z.object({ id: uuid }), request.params);
    const input = parse(updateProductSchema, request.body);
    return database.transaction(async (client) => {
      const context = await resolveStoreContext(request, client);
      const existing = await client.query<{ stock: number }>(
        `SELECT i.stock FROM products p JOIN inventory i ON i.product_id = p.id AND i.store_id = $3
         WHERE p.id = $1 AND p.tenant_id = $2 AND p.active = true FOR UPDATE`,
        [id, request.user.tenantId, context.storeId],
      );
      if (!existing.rows[0])
        throw new HttpError(404, 'Producto no encontrado', 'PRODUCT_NOT_FOUND');
      if (existing.rows[0].stock !== input.expectedStock) {
        throw new HttpError(
          409,
          'La existencia cambio mientras editabas. Recarga el producto antes de ajustar el stock.',
          'INVENTORY_CHANGED',
        );
      }
      await client.query(
        `UPDATE products SET barcode = $3, name = $4, category = $5, image_url = $6, cost = $7, price = $8, updated_at = now()
         WHERE id = $1 AND tenant_id = $2`,
        [
          id,
          request.user.tenantId,
          input.barcode,
          input.name,
          input.category,
          input.imageUrl ?? null,
          input.cost,
          input.price,
        ],
      );
      await client.query(
        'UPDATE inventory SET stock = $3, min_stock = $4, updated_at = now() WHERE store_id = $1 AND product_id = $2',
        [context.storeId, id, input.stock, input.minStock],
      );
      const adjustment = input.stock - existing.rows[0].stock;
      if (adjustment !== 0) {
        await client.query(
          `INSERT INTO stock_movements
            (id, tenant_id, store_id, product_id, user_id, type, quantity, reason)
           VALUES ($1, $2, $3, $4, $5, 'ADJUSTMENT', $6, 'Ajuste manual')`,
          [randomUUID(), request.user.tenantId, context.storeId, id, request.user.sub, adjustment],
        );
      }
      await audit(client, request, 'PRODUCT_UPDATED', 'product', id, { adjustment });
      const products = await productRows(client, request.user.tenantId, context.storeId);
      return mapProduct(products.rows.find((row) => row.id === id)!);
    });
  });

  app.delete('/products/:id', { preHandler: authorize('ADMIN') }, async (request, reply) => {
    const { id } = parse(z.object({ id: uuid }), request.params);
    await database.transaction(async (client) => {
      const result = await client.query(
        'UPDATE products SET active = false, updated_at = now() WHERE id = $1 AND tenant_id = $2 AND active = true RETURNING id',
        [id, request.user.tenantId],
      );
      if (result.rowCount === 0)
        throw new HttpError(404, 'Producto no encontrado', 'PRODUCT_NOT_FOUND');
      await audit(client, request, 'PRODUCT_ARCHIVED', 'product', id);
    });
    return reply.status(204).send();
  });

  app.get('/customers', async (request) => {
    const result = await database.query<CustomerRow>(
      'SELECT * FROM customers WHERE tenant_id = $1 AND active = true ORDER BY name',
      [request.user.tenantId],
    );
    return result.rows.map(mapCustomer);
  });

  app.post('/customers', async (request, reply) => {
    const input = parse(customerSchema, request.body);
    const id = randomUUID();
    const result = await database.transaction(async (client) => {
      const inserted = await client.query<CustomerRow>(
        `INSERT INTO customers (id, tenant_id, name, email, phone, tax_id)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [
          id,
          request.user.tenantId,
          input.name,
          input.email || null,
          input.phone || null,
          input.taxId || null,
        ],
      );
      await audit(client, request, 'CUSTOMER_CREATED', 'customer', id);
      return mapCustomer(inserted.rows[0]!);
    });
    return reply.status(201).send(result);
  });

  app.put('/customers/:id', async (request) => {
    const { id } = parse(z.object({ id: uuid }), request.params);
    const input = parse(customerSchema, request.body);
    return database.transaction(async (client) => {
      const updated = await client.query<CustomerRow>(
        `UPDATE customers SET name = $3, email = $4, phone = $5, tax_id = $6, updated_at = now()
         WHERE id = $1 AND tenant_id = $2 AND active = true RETURNING *`,
        [
          id,
          request.user.tenantId,
          input.name,
          input.email || null,
          input.phone || null,
          input.taxId || null,
        ],
      );
      if (!updated.rows[0]) throw new HttpError(404, 'Cliente no encontrado', 'CUSTOMER_NOT_FOUND');
      await audit(client, request, 'CUSTOMER_UPDATED', 'customer', id);
      return mapCustomer(updated.rows[0]);
    });
  });

  app.delete(
    '/customers/:id',
    { preHandler: authorize('ADMIN', 'MANAGER') },
    async (request, reply) => {
      const { id } = parse(z.object({ id: uuid }), request.params);
      await database.transaction(async (client) => {
        const result = await client.query(
          'UPDATE customers SET active = false, updated_at = now() WHERE id = $1 AND tenant_id = $2 AND active = true RETURNING id',
          [id, request.user.tenantId],
        );
        if (result.rowCount === 0)
          throw new HttpError(404, 'Cliente no encontrado', 'CUSTOMER_NOT_FOUND');
        await audit(client, request, 'CUSTOMER_ARCHIVED', 'customer', id);
      });
      return reply.status(204).send();
    },
  );
}
