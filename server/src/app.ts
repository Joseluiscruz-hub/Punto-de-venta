import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import { config } from './config.js';
import { HttpError } from './http.js';
import { authRoutes } from './routes/auth.js';
import { coreRoutes } from './routes/core.js';

export async function buildApp() {
  const app = Fastify({
    logger: { level: config.NODE_ENV === 'test' ? 'silent' : 'info' },
    trustProxy: config.isProduction,
    bodyLimit: 1_048_576,
    requestIdHeader: 'x-request-id',
  });

  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors, {
    origin: config.WEB_ORIGIN.split(',').map((origin) => origin.trim()),
    credentials: true,
  });
  await app.register(cookie);
  await app.register(jwt, { secret: config.JWT_SECRET });
  await app.register(rateLimit, { max: 300, timeWindow: '1 minute' });

  app.get('/api/health', async () => ({ status: 'ok', database: config.DATABASE_URL ? 'postgresql' : 'pglite' }));
  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.register(coreRoutes, { prefix: '/api' });

  app.setNotFoundHandler((request, reply) => {
    reply.status(404).send({ error: { code: 'NOT_FOUND', message: `Ruta no encontrada: ${request.method} ${request.url}` } });
  });
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof HttpError) {
      return reply.status(error.statusCode).send({ error: { code: error.code, message: error.message } });
    }
    const databaseError = error as { code?: string; constraint?: string };
    if (databaseError.code === '23505') {
      return reply.status(409).send({ error: { code: 'DUPLICATE_RECORD', message: 'Ya existe un registro con esos datos' } });
    }
    request.log.error(error);
    return reply.status(500).send({ error: { code: 'INTERNAL_ERROR', message: 'Ocurrio un error interno' } });
  });

  return app;
}
