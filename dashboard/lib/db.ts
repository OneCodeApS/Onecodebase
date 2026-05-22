import { Pool } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var __pgPool: Pool | undefined;
  // eslint-disable-next-line no-var
  var __pgRealtimePool: Pool | undefined;
}

function buildPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }
  return new Pool({
    connectionString,
    // Sized for a few hundred concurrent users sharing this single dashboard
    // instance. With PgBouncer in front (compose: pgbouncer service) this is
    // the client-side cap on simultaneous transactions, not on actual
    // Postgres backends. PostgREST has its own pool of the same size.
    max: 30,
    idleTimeoutMillis: 30_000,
    // Statement timeout is enforced per-query in the SQL editor;
    // a global default protects against runaway queries from other paths.
    statement_timeout: 30_000,
  });
}

function buildRealtimePool(): Pool {
  // Realtime SSE uses LISTEN, which requires a session-pinned connection.
  // PgBouncer's transaction mode breaks LISTEN, so this pool talks directly
  // to Postgres. Falls back to DATABASE_URL when REALTIME_DATABASE_URL isn't
  // set (e.g., npm run dev outside Docker, where there's no PgBouncer).
  const connectionString =
    process.env.REALTIME_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("REALTIME_DATABASE_URL or DATABASE_URL must be set");
  }
  return new Pool({
    connectionString,
    // Each active SSE subscription holds one connection until the client
    // disconnects, so size for the expected concurrency of subscribers.
    max: 50,
    idleTimeoutMillis: 60_000,
    // LISTEN connections are intentionally long-lived. Don't kill them.
    statement_timeout: 0,
  });
}

export function pool(): Pool {
  if (!globalThis.__pgPool) {
    globalThis.__pgPool = buildPool();
  }
  return globalThis.__pgPool;
}

export function realtimePool(): Pool {
  if (!globalThis.__pgRealtimePool) {
    globalThis.__pgRealtimePool = buildRealtimePool();
  }
  return globalThis.__pgRealtimePool;
}
