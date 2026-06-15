import { randomUUID } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { AuthClaims, ApiRole } from '../auth-types.js';
import { config } from '../config.js';
import { database } from '../database.js';
import { authenticate, HttpError, parse } from '../http.js';
import { createRefreshToken, hashPin, hashToken, verifyPin } from '../security.js';

interface LoginRow {
  id: string;
  tenant_id: string;
  tenant_name: string;
  tenant_plan: 'BASIC' | 'PRO' | 'PREMIUM';
  username: string;
  display_name: string;
  role: ApiRole;
  pin_hash: string;
  active: boolean;
  failed_login_attempts: number;
  locked_until: string | null;
  store_id: string;
  store_name: string;
  store_address: string;
  register_id: string;
  register_code: string;
  register_name: string;
}

const loginSchema = z.object({
  organization: z.string().trim().min(2).max(50).default('EL-TRIUNFO'),
  username: z.string().trim().min(2).max(80),
  pin: z.string().regex(/^\d{4,12}$/, 'El PIN debe contener entre 4 y 12 digitos'),
  storeId: z.string().uuid().optional(),
  registerId: z.string().uuid().optional(),
});

function claimsFrom(row: LoginRow): AuthClaims {
  return {
    sub: row.id,
    tenantId: row.tenant_id,
    role: row.role,
    username: row.username,
    name: row.display_name,
    storeId: row.store_id,
    registerId: row.register_id,
  };
}

function sessionFrom(row: LoginRow, token: string) {
  return {
    user: {
      id: row.id,
      tenantId: row.tenant_id,
      storeId: row.store_id,
      username: row.username,
      name: row.display_name,
      role: row.role,
    },
    tenant: { id: row.tenant_id, name: row.tenant_name, plan: row.tenant_plan },
    store: { id: row.store_id, tenantId: row.tenant_id, name: row.store_name, address: row.store_address },
    register: { id: row.register_id, storeId: row.store_id, code: row.register_code, name: row.register_name },
    token,
  };
}

function setRefreshCookie(reply: FastifyReply, token: string) {
  reply.setCookie('el_triunfo_refresh', token, {
    path: '/api/auth',
    httpOnly: true,
    secure: config.isProduction,
    sameSite: 'strict',
    maxAge: config.REFRESH_TOKEN_DAYS * 24 * 60 * 60,
  });
}

async function createSession(app: FastifyInstance, request: FastifyRequest, reply: FastifyReply, row: LoginRow) {
  const accessToken = app.jwt.sign(claimsFrom(row), { expiresIn: config.ACCESS_TOKEN_TTL });
  const refreshToken = createRefreshToken();
  const expiresAt = new Date(Date.now() + config.REFRESH_TOKEN_DAYS * 86_400_000);
  await database.query(
    `INSERT INTO refresh_sessions
      (id, tenant_id, user_id, token_hash, expires_at, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [randomUUID(), row.tenant_id, row.id, hashToken(refreshToken), expiresAt.toISOString(), request.ip, request.headers['user-agent'] ?? null],
  );
  setRefreshCookie(reply, refreshToken);
  return sessionFrom(row, accessToken);
}

async function findLoginRow(organization: string, username: string, storeId?: string, registerId?: string) {
  const result = await database.query<LoginRow>(
    `SELECT u.id, u.tenant_id, t.name AS tenant_name, t.plan AS tenant_plan,
            u.username, u.display_name, u.role, u.pin_hash, u.active,
            u.failed_login_attempts, u.locked_until,
            s.id AS store_id, s.name AS store_name, s.address AS store_address,
            r.id AS register_id, r.code AS register_code, r.name AS register_name
     FROM users u
     JOIN tenants t ON t.id = u.tenant_id AND t.active = true
     JOIN user_store_access usa ON usa.user_id = u.id
     JOIN stores s ON s.id = usa.store_id AND s.active = true
     JOIN registers r ON r.store_id = s.id AND r.active = true
     WHERE upper(t.code) = upper($1) AND lower(u.username) = lower($2)
       AND ($3::uuid IS NULL OR s.id = $3::uuid)
       AND ($4::uuid IS NULL OR r.id = $4::uuid)
     ORDER BY usa.is_default DESC, s.code, r.code
     LIMIT 1`,
    [organization, username, storeId ?? null, registerId ?? null],
  );
  return result.rows[0];
}

export async function authRoutes(app: FastifyInstance) {
  app.post('/login', { config: { rateLimit: { max: 8, timeWindow: '5 minutes' } } }, async (request, reply) => {
    const input = parse(loginSchema, request.body);
    const row = await findLoginRow(input.organization, input.username, input.storeId, input.registerId);

    if (!row) {
      await hashPin(input.pin);
      throw new HttpError(401, 'Credenciales invalidas', 'INVALID_CREDENTIALS');
    }
    if (!row.active) throw new HttpError(403, 'La cuenta esta desactivada', 'ACCOUNT_DISABLED');
    if (row.locked_until && new Date(row.locked_until) > new Date()) {
      throw new HttpError(423, 'La cuenta esta bloqueada temporalmente', 'ACCOUNT_LOCKED');
    }

    const valid = await verifyPin(input.pin, row.pin_hash);
    if (!valid) {
      const nextAttempts = row.failed_login_attempts + 1;
      const lockedUntil = nextAttempts >= 5 ? new Date(Date.now() + 5 * 60_000).toISOString() : null;
      await database.query(
        'UPDATE users SET failed_login_attempts = $2, locked_until = $3, updated_at = now() WHERE id = $1',
        [row.id, nextAttempts >= 5 ? 0 : nextAttempts, lockedUntil],
      );
      throw new HttpError(401, 'Credenciales invalidas', 'INVALID_CREDENTIALS');
    }

    await database.query(
      'UPDATE users SET failed_login_attempts = 0, locked_until = NULL, last_login_at = now(), updated_at = now() WHERE id = $1',
      [row.id],
    );
    return reply.send(await createSession(app, request, reply, row));
  });

  app.post('/refresh', async (request, reply) => {
    const token = request.cookies.el_triunfo_refresh;
    if (!token) throw new HttpError(401, 'Sesion no disponible', 'REFRESH_REQUIRED');
    const tokenHash = hashToken(token);
    const result = await database.query<{ id: string; user_id: string }>(
      `SELECT id, user_id FROM refresh_sessions
       WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at > now()`,
      [tokenHash],
    );
    const refreshSession = result.rows[0];
    if (!refreshSession) throw new HttpError(401, 'La sesion expiro', 'SESSION_EXPIRED');

    const rowResult = await database.query<LoginRow>(
      `SELECT u.id, u.tenant_id, t.name AS tenant_name, t.plan AS tenant_plan,
              u.username, u.display_name, u.role, u.pin_hash, u.active,
              u.failed_login_attempts, u.locked_until,
              s.id AS store_id, s.name AS store_name, s.address AS store_address,
              r.id AS register_id, r.code AS register_code, r.name AS register_name
       FROM users u
       JOIN tenants t ON t.id = u.tenant_id AND t.active = true
       JOIN user_store_access usa ON usa.user_id = u.id
       JOIN stores s ON s.id = usa.store_id AND s.active = true
       JOIN registers r ON r.store_id = s.id AND r.active = true
       WHERE u.id = $1 AND u.active = true
       ORDER BY usa.is_default DESC, s.code, r.code LIMIT 1`,
      [refreshSession.user_id],
    );
    const row = rowResult.rows[0];
    if (!row) throw new HttpError(401, 'La cuenta ya no esta disponible', 'ACCOUNT_DISABLED');

    await database.query('UPDATE refresh_sessions SET revoked_at = now(), last_used_at = now() WHERE id = $1', [refreshSession.id]);
    return reply.send(await createSession(app, request, reply, row));
  });

  app.post('/logout', async (request, reply) => {
    const token = request.cookies.el_triunfo_refresh;
    if (token) await database.query('UPDATE refresh_sessions SET revoked_at = now() WHERE token_hash = $1', [hashToken(token)]);
    reply.clearCookie('el_triunfo_refresh', { path: '/api/auth' });
    return reply.status(204).send();
  });

  app.get('/me', { preHandler: authenticate }, async (request) => ({ user: request.user }));
}
