import 'dotenv/config';
import { resolve } from 'node:path';
import { z } from 'zod';

const optionalSecret = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.string().min(6).max(128).optional(),
);

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_HOST: z.string().default('127.0.0.1'),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  WEB_ORIGIN: z.string().default('http://127.0.0.1:5173'),
  DATABASE_URL: z.string().optional(),
  PGLITE_DATA_DIR: z.string().default('.data/postgres'),
  JWT_SECRET: z.string().min(32).default('local-development-secret-change-before-production'),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_DAYS: z.coerce.number().int().min(1).max(90).default(7),
  SEED_ADMIN_PIN: optionalSecret,
  SEED_CASHIER_PIN: optionalSecret,
});

const parsed = schema.parse(process.env);

if (parsed.NODE_ENV === 'production') {
  const errors: string[] = [];
  if (parsed.JWT_SECRET === 'local-development-secret-change-before-production') {
    errors.push('JWT_SECRET must be configured');
  }
  if (!parsed.DATABASE_URL) errors.push('DATABASE_URL must use an external PostgreSQL database');
  const invalidOrigin = parsed.WEB_ORIGIN.split(',').some((rawOrigin) => {
    const origin = rawOrigin.trim();
    try {
      const url = new URL(origin);
      return (
        url.protocol !== 'https:' ||
        Boolean(url.username || url.password || url.search || url.hash) ||
        (url.pathname !== '/' && url.pathname !== '') ||
        /^(?:localhost|127\.0\.0\.1)$/i.test(url.hostname)
      );
    } catch {
      return true;
    }
  });
  if (invalidOrigin) {
    errors.push('WEB_ORIGIN must contain only valid HTTPS production origins');
  }
  if (errors.length > 0) throw new Error(`Invalid production configuration: ${errors.join('; ')}`);
}

export const config = {
  ...parsed,
  pgliteDataDir: resolve(process.cwd(), parsed.PGLITE_DATA_DIR),
  isProduction: parsed.NODE_ENV === 'production',
};
