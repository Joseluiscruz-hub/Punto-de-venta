import { randomUUID } from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { ZodError, type ZodType } from 'zod';
import type { ApiRole } from './auth-types.js';
import type { QueryClient } from './database.js';

export class HttpError extends Error {
  constructor(public statusCode: number, message: string, public code = 'REQUEST_ERROR') {
    super(message);
  }
}

export function parse<T>(schema: ZodType<T>, value: unknown): T {
  try {
    return schema.parse(value);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new HttpError(400, error.issues[0]?.message ?? 'Solicitud invalida', 'VALIDATION_ERROR');
    }
    throw error;
  }
}

export async function authenticate(request: FastifyRequest) {
  await request.jwtVerify();
}

export function authorize(...roles: ApiRole[]) {
  return async (request: FastifyRequest) => {
    await authenticate(request);
    if (!roles.includes(request.user.role)) throw new HttpError(403, 'No tienes permiso para realizar esta accion', 'FORBIDDEN');
  };
}

export async function resolveStoreContext(request: FastifyRequest, client: QueryClient) {
  const requestedStore = typeof request.headers['x-store-id'] === 'string'
    ? request.headers['x-store-id']
    : request.user.storeId;
  const requestedRegister = typeof request.headers['x-register-id'] === 'string'
    ? request.headers['x-register-id']
    : request.user.registerId;

  const access = await client.query<{ store_id: string; register_id: string }>(
    `SELECT s.id AS store_id, r.id AS register_id
     FROM user_store_access usa
     JOIN stores s ON s.id = usa.store_id AND s.active = true
     JOIN registers r ON r.store_id = s.id AND r.active = true
     WHERE usa.user_id = $1::uuid AND s.tenant_id = $2::uuid
       AND s.id = $3::uuid AND r.id = $4::uuid`,
    [request.user.sub, request.user.tenantId, requestedStore, requestedRegister],
  );
  if (access.rowCount === 0) throw new HttpError(403, 'No tienes acceso a la sucursal o caja seleccionada', 'STORE_ACCESS_DENIED');
  return { storeId: requestedStore, registerId: requestedRegister };
}

export async function audit(
  client: QueryClient,
  request: FastifyRequest,
  action: string,
  entityType: string,
  entityId?: string,
  details: Record<string, unknown> = {},
) {
  await client.query(
    `INSERT INTO audit_events
      (id, tenant_id, actor_user_id, store_id, action, entity_type, entity_id, details, ip_address)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9)`,
    [randomUUID(), request.user.tenantId, request.user.sub, request.user.storeId, action, entityType,
      entityId ?? null, JSON.stringify(details), request.ip],
  );
}

export function sendError(reply: FastifyReply, error: unknown) {
  if (error instanceof HttpError) {
    return reply.status(error.statusCode).send({ error: { code: error.code, message: error.message } });
  }
  throw error;
}
