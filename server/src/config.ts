import 'dotenv/config';
import { resolve } from 'node:path';
import { z } from 'zod';

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
});

const parsed = schema.parse(process.env);

if (parsed.NODE_ENV === 'production' && parsed.JWT_SECRET === 'local-development-secret-change-before-production') {
  throw new Error('JWT_SECRET must be configured in production');
}

export const config = {
  ...parsed,
  pgliteDataDir: resolve(process.cwd(), parsed.PGLITE_DATA_DIR),
  isProduction: parsed.NODE_ENV === 'production',
};
