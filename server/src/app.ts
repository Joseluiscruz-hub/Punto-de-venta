import { existsSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import staticFiles from '@fastify/static';
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
  const staticRoot = resolve(process.cwd(), 'dist');
  const serveStatic = existsSync(staticRoot);
  if (config.isProduction && !serveStatic) {
    throw new Error('Production frontend is missing. Run npm run build before npm start.');
  }
  if (serveStatic) {
    await app.register(staticFiles, {
      root: staticRoot,
      cacheControl: false,
      setHeaders(response, filePath) {
        const normalizedPath = filePath.replaceAll('\\', '/');
        const fileName = normalizedPath.split('/').at(-1);
        if (
          fileName === 'index.html' ||
          fileName === 'sw.js' ||
          fileName === 'registerSW.js' ||
          fileName === 'manifest.webmanifest'
        ) {
          response.header('Cache-Control', 'no-cache, no-store, must-revalidate');
        } else if (normalizedPath.includes('/assets/')) {
          response.header('Cache-Control', 'public, max-age=31536000, immutable');
        } else {
          response.header('Cache-Control', 'public, max-age=86400');
        }
      },
    });
  }

  app.setNotFoundHandler((request, reply) => {
    const pathname = request.url.split('?', 1)[0] ?? '';
    const acceptsHtml = request.headers.accept?.includes('text/html') ?? false;
    if (
      serveStatic &&
      request.method === 'GET' &&
      !pathname.startsWith('/api') &&
      extname(pathname) === '' &&
      acceptsHtml
    ) {
      return reply
        .header('Cache-Control', 'no-cache, no-store, must-revalidate')
        .sendFile('index.html');
    }
    reply.status(404).send({
      error: {
        code: 'NOT_FOUND',
        message: `Ruta no encontrada: ${request.method} ${request.url}`,
      },
    });
  });
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof HttpError) {
      return reply
        .status(error.statusCode)
        .send({ error: { code: error.code, message: error.message } });
    }
    const databaseError = error as { code?: string; constraint?: string };
    if (databaseError.code === '23505') {
      return reply.status(409).send({
        error: { code: 'DUPLICATE_RECORD', message: 'Ya existe un registro con esos datos' },
      });
    }
    request.log.error(error);
    return reply
      .status(500)
      .send({ error: { code: 'INTERNAL_ERROR', message: 'Ocurrio un error interno' } });
  });

  // Register routes only after the shared handlers so encapsulated route plugins inherit
  // the same stable error envelope.
  app.get('/api/health', async () => ({
    status: 'ok',
    database: config.DATABASE_URL ? 'postgresql' : 'pglite',
  }));
  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.register(coreRoutes, { prefix: '/api' });

  return app;
}
