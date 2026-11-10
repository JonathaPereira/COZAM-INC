import pg from 'pg';
import { PGlite } from '@electric-sql/pglite';
import { config } from '../config.js';

export interface QueryResult<R = any> {
  rows: R[];
  rowCount: number;
}

export interface DbClient {
  query<R = any>(text: string, params?: any[]): Promise<QueryResult<R>>;
  exec(sql: string): Promise<void>;
  release(): void;
}

export interface DbPool {
  query<R = any>(text: string, params?: any[]): Promise<QueryResult<R>>;
  exec(sql: string): Promise<void>;
  connect(): Promise<DbClient>;
  end(): Promise<void>;
  isPGlite(): boolean;
}

class PgPoolAdapter implements DbPool {
  private pool: pg.Pool;

  constructor(connectionString: string) {
    this.pool = new pg.Pool({
      connectionString,
      ssl: connectionString.includes('localhost') ? false : { rejectUnauthorized: false },
      max: 20,
      idleTimeoutMillis: 30000,
    });
  }

  async query<R = any>(text: string, params?: any[]): Promise<QueryResult<R>> {
    const res = await this.pool.query(text, params);
    return { rows: res.rows as R[], rowCount: res.rowCount ?? res.rows.length };
  }

  async exec(sql: string): Promise<void> {
    await this.pool.query(sql);
  }

  async connect(): Promise<DbClient> {
    const client = await this.pool.connect();
    return {
      query: async <R = any>(text: string, params?: any[]) => {
        const res = await client.query(text, params);
        return { rows: res.rows as R[], rowCount: res.rowCount ?? res.rows.length };
      },
      exec: async (sql: string) => {
        await client.query(sql);
      },
      release: () => client.release(),
    };
  }

  async end(): Promise<void> {
    await this.pool.end();
  }

  isPGlite(): boolean {
    return false;
  }
}

class PGlitePoolAdapter implements DbPool {
  private pglite: PGlite;

  constructor(pgliteInstance?: PGlite) {
    this.pglite = pgliteInstance ?? new PGlite();
  }

  async query<R = any>(text: string, params?: any[]): Promise<QueryResult<R>> {
    if (!params || params.length === 0) {
      // Se não houver parâmetros e tiver ponto e vírgula, usa exec
      if (text.includes(';') && text.trim().split(';').filter((s) => s.trim().length > 0).length > 1) {
        await this.pglite.exec(text);
        return { rows: [], rowCount: 0 };
      }
    }
    const res = await this.pglite.query(text, params);
    return { rows: res.rows as R[], rowCount: (res.rows as any[]).length };
  }

  async exec(sql: string): Promise<void> {
    await this.pglite.exec(sql);
  }

  async connect(): Promise<DbClient> {
    return {
      query: async <R = any>(text: string, params?: any[]) => {
        if (!params || params.length === 0) {
          if (text.includes(';') && text.trim().split(';').filter((s) => s.trim().length > 0).length > 1) {
            await this.pglite.exec(text);
            return { rows: [], rowCount: 0 };
          }
        }
        const res = await this.pglite.query(text, params);
        return { rows: res.rows as R[], rowCount: (res.rows as any[]).length };
      },
      exec: async (sql: string) => {
        await this.pglite.exec(sql);
      },
      release: () => {
        // no-op for single-instance in-memory
      },
    };
  }

  async end(): Promise<void> {
    await this.pglite.close();
  }

  isPGlite(): boolean {
    return true;
  }

  getRaw(): PGlite {
    return this.pglite;
  }
}

let activePool: DbPool | null = null;

export function getPool(): DbPool {
  if (activePool) return activePool;

  if (config.databaseUrl) {
    activePool = new PgPoolAdapter(config.databaseUrl);
  } else {
    activePool = new PGlitePoolAdapter();
  }
  return activePool;
}

export function setCustomPool(pool: DbPool): void {
  activePool = pool;
}

export function createPGlitePool(instance?: PGlite): DbPool {
  return new PGlitePoolAdapter(instance);
}
