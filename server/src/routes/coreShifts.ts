import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { config } from '../config.js';
import { database } from '../database.js';
import { audit, HttpError, parse, resolveStoreContext } from '../http.js';
import {
  uuid,
  cashMovementSchema,
  money,
  mapShift,
  mapCashMovement,
  assertCanOperateShift,
  assertCashMovementReplayScope,
  type ShiftRow,
  type CashMovementRow,
} from './coreHelpers.js';

export function registerShiftRoutes(app: FastifyInstance) {
  app.get('/shifts/active', async (request) => {
    const context = await resolveStoreContext(request, database);
    const result = await database.query<ShiftRow>(
      `SELECT s.*,
      (SELECT COUNT(*)::int FROM sales sa WHERE sa.shift_id = s.id) AS sales_count
       FROM shifts s WHERE s.tenant_id = $1 AND s.register_id = $2 AND s.status = 'OPEN' LIMIT 1`,
      [request.user.tenantId, context.registerId],
    );
    const shift = result.rows[0];
    if (!shift) return null;
    assertCanOperateShift(request, shift);
    return mapShift(shift);
  });

  app.get('/shifts', async (request) => {
    const context = await resolveStoreContext(request, database);
    const result = await database.query<ShiftRow>(
      `SELECT s.*,
      (SELECT COUNT(*)::int FROM sales sa WHERE sa.shift_id = s.id) AS sales_count
       FROM shifts s WHERE s.tenant_id = $1 AND s.store_id = $2 ORDER BY s.start_time DESC LIMIT 200`,
      [request.user.tenantId, context.storeId],
    );
    return result.rows.map(mapShift);
  });

  app.post('/shifts/open', async (request, reply) => {
    const input = parse(
      z.object({ initialCash: z.coerce.number().min(0).max(99_999_999) }),
      request.body,
    );
    const shift = await database.transaction(async (client) => {
      const context = await resolveStoreContext(request, client);
      const existing = await client.query<{ id: string }>(
        `SELECT id FROM shifts WHERE register_id = $1 AND status = 'OPEN' FOR UPDATE`,
        [context.registerId],
      );
      if (existing.rowCount > 0)
        throw new HttpError(409, 'La caja ya tiene un turno abierto', 'SHIFT_ALREADY_OPEN');
      const id = randomUUID();
      const inserted = await client.query<ShiftRow>(
        `INSERT INTO shifts
          (id, tenant_id, store_id, register_id, user_id, initial_cash, expected_cash, status)
         VALUES ($1, $2, $3, $4, $5, $6, $6, 'OPEN') RETURNING *`,
        [
          id,
          request.user.tenantId,
          context.storeId,
          context.registerId,
          request.user.sub,
          input.initialCash,
        ],
      );
      await audit(client, request, 'SHIFT_OPENED', 'shift', id, { initialCash: input.initialCash });
      return mapShift(inserted.rows[0]!);
    });
    return reply.status(201).send(shift);
  });

  app.post('/shifts/:id/close', async (request) => {
    const { id } = parse(z.object({ id: uuid }), request.params);
    const input = parse(
      z.object({ actualCash: z.coerce.number().min(0).max(99_999_999) }),
      request.body,
    );
    return database.transaction(async (client) => {
      const context = await resolveStoreContext(request, client);
      const canCloseOtherShift = request.user.role === 'ADMIN' || request.user.role === 'MANAGER';
      const result = await client.query<ShiftRow>(
        `UPDATE shifts SET status = 'CLOSED', end_time = now(), actual_cash = $4,
           difference = $4 - expected_cash
         WHERE id = $1 AND tenant_id = $2 AND register_id = $3
           AND (user_id = $5 OR $6::boolean) AND status = 'OPEN'
         RETURNING *`,
        [
          id,
          request.user.tenantId,
          context.registerId,
          input.actualCash,
          request.user.sub,
          canCloseOtherShift,
        ],
      );
      if (!result.rows[0])
        throw new HttpError(404, 'Turno activo no encontrado', 'SHIFT_NOT_FOUND');
      const difference = money(result.rows[0].difference) ?? 0;
      await audit(client, request, 'SHIFT_CLOSED', 'shift', id, {
        actualCash: input.actualCash,
        difference,
        exceedsThreshold: Math.abs(difference) > config.CASH_DIFFERENCE_THRESHOLD,
        differenceThreshold: config.CASH_DIFFERENCE_THRESHOLD,
        openedByUserId: result.rows[0].user_id,
        closedByDifferentUser: result.rows[0].user_id !== request.user.sub,
      });
      return mapShift(result.rows[0]);
    });
  });

  app.get('/shifts/:id/cash-movements', async (request) => {
    const { id } = parse(z.object({ id: uuid }), request.params);
    const context = await resolveStoreContext(request, database);
    const shift = await database.query<{ id: string }>(
      'SELECT id FROM shifts WHERE id = $1 AND tenant_id = $2 AND store_id = $3',
      [id, request.user.tenantId, context.storeId],
    );
    if (shift.rowCount === 0) throw new HttpError(404, 'Turno no encontrado', 'SHIFT_NOT_FOUND');
    const result = await database.query<CashMovementRow>(
      'SELECT * FROM cash_movements WHERE shift_id = $1 ORDER BY created_at DESC, id DESC',
      [id],
    );
    return result.rows.map(mapCashMovement);
  });

  app.post('/shifts/:id/cash-movements', async (request, reply) => {
    const { id } = parse(z.object({ id: uuid }), request.params);
    const input = parse(cashMovementSchema, request.body);
    const result = await database.transaction(async (client) => {
      const context = await resolveStoreContext(request, client);
      const duplicate = await client.query<CashMovementRow>(
        'SELECT * FROM cash_movements WHERE tenant_id = $1 AND external_id = $2',
        [request.user.tenantId, input.externalId],
      );
      if (duplicate.rows[0]) {
        assertCashMovementReplayScope(request, context, id, duplicate.rows[0]);
        return mapCashMovement(duplicate.rows[0]);
      }

      const shiftResult = await client.query<ShiftRow>(
        `SELECT * FROM shifts
         WHERE id = $1 AND tenant_id = $2 AND store_id = $3 AND register_id = $4
           AND status = 'OPEN'
         FOR UPDATE`,
        [id, request.user.tenantId, context.storeId, context.registerId],
      );
      const shift = shiftResult.rows[0];
      if (!shift) throw new HttpError(404, 'Turno activo no encontrado', 'SHIFT_NOT_FOUND');
      assertCanOperateShift(request, shift);
      if (input.type === 'CASH_OUT' && input.amount > Number(shift.expected_cash)) {
        throw new HttpError(
          409,
          'El retiro no puede ser mayor al efectivo esperado en caja',
          'INSUFFICIENT_CASH',
        );
      }

      const movementId = randomUUID();
      const inserted = await client.query<CashMovementRow>(
        `INSERT INTO cash_movements
          (id, external_id, tenant_id, store_id, register_id, shift_id, user_id, type, amount, reason)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (tenant_id, external_id) DO NOTHING
         RETURNING *`,
        [
          movementId,
          input.externalId,
          request.user.tenantId,
          context.storeId,
          context.registerId,
          id,
          request.user.sub,
          input.type,
          input.amount,
          input.reason,
        ],
      );
      if (!inserted.rows[0]) {
        const existing = await client.query<CashMovementRow>(
          'SELECT * FROM cash_movements WHERE tenant_id = $1 AND external_id = $2',
          [request.user.tenantId, input.externalId],
        );
        if (!existing.rows[0]) {
          throw new HttpError(409, 'No se pudo confirmar el movimiento', 'IDEMPOTENCY_CONFLICT');
        }
        assertCashMovementReplayScope(request, context, id, existing.rows[0]);
        return mapCashMovement(existing.rows[0]);
      }
      if (input.type === 'CASH_IN') {
        await client.query(
          'UPDATE shifts SET cash_in = cash_in + $2, expected_cash = expected_cash + $2 WHERE id = $1',
          [id, input.amount],
        );
      } else {
        await client.query(
          'UPDATE shifts SET cash_out = cash_out + $2, expected_cash = expected_cash - $2 WHERE id = $1',
          [id, input.amount],
        );
      }
      await audit(client, request, input.type, 'cash_movement', movementId, {
        shiftId: id,
        amount: input.amount,
        reason: input.reason,
      });
      return mapCashMovement(inserted.rows[0]!);
    });
    return reply.status(201).send(result);
  });
}
