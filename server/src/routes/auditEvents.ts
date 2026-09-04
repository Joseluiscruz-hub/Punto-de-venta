import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { database } from '../database.js';
import { authorize, parse } from '../http.js';

const uuid = z.string().uuid();

export function registerAuditRoutes(app: FastifyInstance) {
  app.get(
    '/audit-events',
    { preHandler: authorize('ADMIN', 'MANAGER') },
    async (request: FastifyRequest) => {
      const emptyToUndefined = (value: unknown) =>
        typeof value === 'string' && value.trim() === '' ? undefined : value;
      const optionalText = z.preprocess(emptyToUndefined, z.string().trim().max(120).optional());
      const optionalDate = z.preprocess(emptyToUndefined, z.string().trim().min(4).max(40).optional());
      const query = parse(
        z.object({
          action: optionalText,
          entityType: optionalText,
          storeId: z.preprocess(emptyToUndefined, uuid.optional()),
          from: optionalDate,
          to: optionalDate,
          q: optionalText,
          limit: z.coerce.number().int().min(1).max(1000).default(200),
        }),
        request.query,
      );

      const filters = ['ae.tenant_id = $1'];
      const params: unknown[] = [request.user.tenantId];

      if (query.action) {
        params.push(query.action);
        filters.push(`ae.action = $${params.length}`);
      }
      if (query.entityType) {
        params.push(query.entityType);
        filters.push(`ae.entity_type = $${params.length}`);
      }
      if (query.storeId) {
        params.push(query.storeId);
        filters.push(`ae.store_id = $${params.length}`);
      }
      if (query.from) {
        params.push(query.from);
        filters.push(`ae.created_at >= $${params.length}::timestamptz`);
      }
      if (query.to) {
        params.push(query.to);
        filters.push(`ae.created_at <= $${params.length}::timestamptz`);
      }
      if (query.q) {
        params.push(`%${query.q.toLowerCase()}%`);
        filters.push(
          `(lower(ae.action) LIKE $${params.length} OR lower(ae.entity_type) LIKE $${params.length} OR lower(coalesce(ae.entity_id, '')) LIKE $${params.length} OR lower(coalesce(u.display_name, '')) LIKE $${params.length} OR lower(coalesce(ae.details::text, '')) LIKE $${params.length})`,
        );
      }
      params.push(query.limit);
      const limitParam = params.length;

      const result = await database.query<{
        id: string;
        tenant_id: string;
        actor_user_id: string | null;
        actor_name: string | null;
        store_id: string | null;
        action: string;
        entity_type: string;
        entity_id: string | null;
        details: Record<string, unknown> | string;
        ip_address: string | null;
        created_at: string;
      }>(
        `SELECT ae.id, ae.tenant_id, ae.actor_user_id, u.display_name AS actor_name,
                ae.store_id, ae.action, ae.entity_type, ae.entity_id, ae.details,
                ae.ip_address, ae.created_at
         FROM audit_events ae
         LEFT JOIN users u ON u.id = ae.actor_user_id
         WHERE ${filters.join(' AND ')}
         ORDER BY ae.created_at DESC
         LIMIT $${limitParam}`,
        params,
      );

      return result.rows.map((row) => ({
        id: row.id,
        tenantId: row.tenant_id,
        actorUserId: row.actor_user_id ?? undefined,
        actorName: row.actor_name ?? undefined,
        storeId: row.store_id ?? undefined,
        action: row.action,
        entityType: row.entity_type,
        entityId: row.entity_id ?? undefined,
        details:
          typeof row.details === 'string'
            ? (JSON.parse(row.details) as Record<string, unknown>)
            : (row.details ?? {}),
        ipAddress: row.ip_address ?? undefined,
        createdAt: row.created_at,
      }));
    },
  );
}
