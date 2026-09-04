import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { after, before, test } from 'node:test';
import type { FastifyInstance } from 'fastify';

const testDataDir = `.data/audit-test-${randomUUID()}`;
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
  return response.json() as { token: string };
}

test('admin puede consultar auditoria con filtros y forma camelCase', async () => {
  const session = await login('admin', '1234');
  const response = await app.inject({
    method: 'GET',
    url: '/api/audit-events?limit=20&action=SHIFT_CLOSED',
    headers: { authorization: `Bearer ${session.token}` },
  });
  assert.equal(response.statusCode, 200, response.body);
  const rows = response.json() as Array<Record<string, unknown>>;
  assert.ok(Array.isArray(rows));
  for (const row of rows) {
    assert.equal(typeof row.id, 'string');
    assert.equal(typeof row.action, 'string');
    assert.equal(typeof row.entityType, 'string');
    assert.equal(typeof row.createdAt, 'string');
    assert.equal(row.entity_type, undefined);
  }
});

test('cajero no puede consultar auditoria', async () => {
  const session = await login('caja1', '0000');
  const response = await app.inject({
    method: 'GET',
    url: '/api/audit-events',
    headers: { authorization: `Bearer ${session.token}` },
  });
  assert.equal(response.statusCode, 403, response.body);
});
