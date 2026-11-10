import type { DbClient, DbPool } from './pool.js';
import { getPool } from './pool.js';

export interface TxContext {
  actorId?: string | null;
  reason?: string | null;
  requestId?: string | null;
}

export async function runInTransaction<T>(
  ctx: TxContext,
  fn: (client: DbClient) => Promise<T>,
  poolOverride?: DbPool
): Promise<T> {
  const pool = poolOverride ?? getPool();
  const client = await pool.connect();
  try {
    await client.query('begin');

    if (ctx.actorId) {
      // Usar set_config com is_local = true para que valha somente dentro da transação atual
      await client.query(`select set_config('app.actor_id', $1, true)`, [ctx.actorId]);
    }
    if (ctx.reason) {
      await client.query(`select set_config('app.reason', $1, true)`, [ctx.reason]);
    }
    if (ctx.requestId) {
      await client.query(`select set_config('app.request_id', $1, true)`, [ctx.requestId]);
    }

    const result = await fn(client);
    await client.query('commit');
    return result;
  } catch (err) {
    try {
      await client.query('rollback');
    } catch {
      // ignora erro no rollback
    }
    throw err;
  } finally {
    client.release();
  }
}
