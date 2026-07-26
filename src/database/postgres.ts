import { Pool } from "pg";
import type { Env } from "../config/env";

let pool: Pool | undefined;

function getPool(env: Env): Pool {
  if (!pool) {
    pool = new Pool({ connectionString: env.DATABASE_URL });
  }
  return pool;
}

export async function testConnection(env: Env): Promise<Date> {
  const result = await getPool(env).query<{ now: Date }>("SELECT NOW()");
  const row = result.rows[0];
  if (!row) {
    throw new Error("SELECT NOW() returned no rows");
  }
  return row.now;
}
