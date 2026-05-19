import { Pool } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var __pgPool: Pool | undefined;
}

function buildPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }
  return new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30_000,
    // Statement timeout is enforced per-query in the SQL editor;
    // a global default protects against runaway queries from other paths.
    statement_timeout: 30_000,
  });
}

export const pool: Pool = globalThis.__pgPool ?? buildPool();
if (process.env.NODE_ENV !== "production") {
  globalThis.__pgPool = pool;
}
