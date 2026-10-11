import { db as sqliteDb, initDatabase as initSqliteDatabase } from './index.ts';
import { getPgPool, initPgDatabase, translateSqlToPg, closePgPool } from './pg.ts';

export function isPg(): boolean {
  return Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL.trim().length > 0);
}

export async function initDb(): Promise<void> {
  if (isPg()) {
    console.log('[Database Adapter] Mode: PostgreSQL');
    await initPgDatabase();
  } else {
    console.log('[Database Adapter] Mode: SQLite');
    initSqliteDatabase();
  }
}

export async function closeDb(): Promise<void> {
  if (isPg()) {
    await closePgPool();
  } else {
    try {
      sqliteDb.close();
      console.log('[SQLite] Database closed.');
    } catch (e) {
      // Ignore if already closed
    }
  }
}

export async function query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  if (isPg()) {
    const pool = getPgPool();
    const pgSql = translateSqlToPg(sql);
    const res = await pool.query(pgSql, params);
    return res.rows as T[];
  } else {
    return sqliteDb.prepare(sql).all(...params) as T[];
  }
}

export async function queryOne<T = any>(sql: string, params: any[] = []): Promise<T | null> {
  if (isPg()) {
    const rows = await query<T>(sql, params);
    return rows.length > 0 ? rows[0] : null;
  } else {
    const res = sqliteDb.prepare(sql).get(...params) as T | undefined;
    return res !== undefined ? res : null;
  }
}

export async function execute(sql: string, params: any[] = []): Promise<{ rowsAffected: number; lastInsertId?: string | number }> {
  if (isPg()) {
    const pool = getPgPool();
    const pgSql = translateSqlToPg(sql);
    const res = await pool.query(pgSql, params);
    return { rowsAffected: res.rowCount || 0 };
  } else {
    const res = sqliteDb.prepare(sql).run(...params);
    return { rowsAffected: res.changes, lastInsertId: typeof res.lastInsertRowid === 'bigint' ? Number(res.lastInsertRowid) : res.lastInsertRowid };
  }
}

export interface TransactionContext {
  query: <R = any>(sql: string, params?: any[]) => Promise<R[]>;
  queryOne: <R = any>(sql: string, params?: any[]) => Promise<R | null>;
  execute: (sql: string, params?: any[]) => Promise<{ rowsAffected: number }>;
}

export async function transaction<T>(callback: (tx: TransactionContext) => Promise<T>): Promise<T> {
  if (isPg()) {
    const pool = getPgPool();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const tx: TransactionContext = {
        query: async <R = any>(sql: string, params: any[] = []) => {
          const pgSql = translateSqlToPg(sql);
          const res = await client.query(pgSql, params);
          return res.rows as R[];
        },
        queryOne: async <R = any>(sql: string, params: any[] = []) => {
          const pgSql = translateSqlToPg(sql);
          const res = await client.query(pgSql, params);
          return res.rows.length > 0 ? (res.rows[0] as R) : null;
        },
        execute: async (sql: string, params: any[] = []) => {
          const pgSql = translateSqlToPg(sql);
          const res = await client.query(pgSql, params);
          return { rowsAffected: res.rowCount || 0 };
        },
      };
      const result = await callback(tx);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } else {
    // For SQLite, execute callback using sqlite db methods
    const tx: TransactionContext = {
      query: async <R = any>(sql: string, params: any[] = []) => {
        return sqliteDb.prepare(sql).all(...params) as R[];
      },
      queryOne: async <R = any>(sql: string, params: any[] = []) => {
        const res = sqliteDb.prepare(sql).get(...params) as R | undefined;
        return res !== undefined ? res : null;
      },
      execute: async (sql: string, params: any[] = []) => {
        const res = sqliteDb.prepare(sql).run(...params);
        return { rowsAffected: res.changes };
      },
    };

    let result: T;
    let syncError: any = null;

    // Execute in a synchronous better-sqlite3 transaction boundary
    const runTx = sqliteDb.transaction(() => {
      // Synchronous execution block
    });

    try {
      sqliteDb.exec('BEGIN TRANSACTION');
      result = await callback(tx);
      sqliteDb.exec('COMMIT');
      return result;
    } catch (err) {
      try {
        sqliteDb.exec('ROLLBACK');
      } catch (rollbackErr) {
        // Ignore rollback error if transaction wasn't active
      }
      throw err;
    }
  }
}
