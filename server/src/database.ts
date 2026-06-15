import { mkdir, readdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import pg from 'pg';
import { config } from './config.js';

export interface QueryResult<T> {
  rows: T[];
  rowCount: number;
}

export interface QueryClient {
  query<T>(sql: string, params?: unknown[]): Promise<QueryResult<T>>;
  exec(sql: string): Promise<void>;
}

type TransactionWork<T> = (client: QueryClient) => Promise<T>;

export class Database implements QueryClient {
  private pool?: pg.Pool;
  private embedded?: PGlite;

  async connect() {
    if (config.DATABASE_URL) {
      this.pool = new pg.Pool({ connectionString: config.DATABASE_URL, max: 10 });
      await this.pool.query('SELECT 1');
      return;
    }

    await mkdir(dirname(config.pgliteDataDir), { recursive: true });
    this.embedded = new PGlite(config.pgliteDataDir);
    await this.embedded.waitReady;
  }

  async query<T>(sql: string, params: unknown[] = []): Promise<QueryResult<T>> {
    if (this.pool) {
      const result = await this.pool.query(sql, params);
      return { rows: result.rows as T[], rowCount: result.rowCount ?? 0 };
    }
    if (!this.embedded) throw new Error('Database is not connected');
    const result = await this.embedded.query<T>(sql, params);
    return { rows: result.rows, rowCount: result.rows.length > 0 ? result.rows.length : (result.affectedRows ?? 0) };
  }

  async exec(sql: string): Promise<void> {
    if (this.pool) {
      await this.pool.query(sql);
      return;
    }
    if (!this.embedded) throw new Error('Database is not connected');
    await this.embedded.exec(sql);
  }

  async transaction<T>(work: TransactionWork<T>): Promise<T> {
    if (this.pool) {
      const client = await this.pool.connect();
      try {
        await client.query('BEGIN');
        const result = await work({
          query: async <Row>(sql: string, params: unknown[] = []) => {
            const queryResult = await client.query(sql, params);
            return { rows: queryResult.rows as Row[], rowCount: queryResult.rowCount ?? 0 };
          },
          exec: async (sql: string) => { await client.query(sql); },
        });
        await client.query('COMMIT');
        return result;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    }

    if (!this.embedded) throw new Error('Database is not connected');
    return this.embedded.transaction(async (transaction) => work({
      query: async <Row>(sql: string, params: unknown[] = []) => {
        const result = await transaction.query<Row>(sql, params);
        return { rows: result.rows, rowCount: result.rows.length > 0 ? result.rows.length : (result.affectedRows ?? 0) };
      },
      exec: async (sql: string) => { await transaction.exec(sql); },
    }));
  }

  async migrate() {
    const migrationsPath = resolve(process.cwd(), 'server/migrations');
    const files = (await readdir(migrationsPath)).filter((file) => file.endsWith('.sql')).sort();

    for (const file of files) {
      const version = file.replace(/\.sql$/, '');
      await this.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
        version text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )`);
      const applied = await this.query<{ version: string }>('SELECT version FROM schema_migrations WHERE version = $1', [version]);
      if (applied.rowCount > 0) continue;
      const sql = await readFile(resolve(migrationsPath, file), 'utf8');
      await this.transaction(async (client) => {
        await client.exec(sql);
        await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [version]);
      });
    }
  }

  async close() {
    if (this.pool) await this.pool.end();
    if (this.embedded) await this.embedded.close();
  }
}

export const database = new Database();
