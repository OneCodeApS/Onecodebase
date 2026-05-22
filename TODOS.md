# TODOs

Open items surfaced during recent work but deferred. Not a backlog of features — only items where we made an explicit "park it for now" call and where future-me (or future-you) should know it's known.

Sorted roughly by when it bites, not by effort.

---

## Hits first under sustained load

### Audit chain advisory lock
`lib/audit.ts` serialises inserts with `pg_advisory_xact_lock(CHAIN_LOCK_KEY)` so the SHA-256 chain is well-defined. Caps audited writes at roughly **500/sec**.

- **Hits when:** sustained logins + edge-function invocations + SQL editor activity together push audit throughput past that. Likely the first real ceiling once end-user auth is in production traffic.
- **Options when needed:**
  1. Drop the lock; compute `prev_hash` from a small in-process buffer and flush asynchronously. Chain remains intact but writes don't serialise.
  2. Shard the chain by actor or by hour — multiple parallel chains, verified independently.
  3. Drop the chain altogether and rely on the JSONL files for tamper evidence.
- **Note:** every option weakens the current "any row tampered with after the fact is detectable" guarantee somewhat. Discuss before touching.

### Single dashboard process
`instrumentation.ts` boots the cron scheduler and the audit-retention sweeper in-process. Running two dashboard replicas behind Caddy would double-fire both.

- **Hits when:** we want horizontal scaling for throughput or HA.
- **Fix:** extract scheduler + sweeper into either (a) a dedicated worker container, or (b) a leader-elect pattern using a Postgres session-level advisory lock so only one replica's scheduler is "active" at a time.
- **Also needed before this works:** the edge-function compile cache (`globalThis.__fnCompileCache`) is per-process. Multi-instance means each replica compiles its own copy — fine, just understand the memory cost scales with replicas.

### MinIO walk on every Home load
`lib/stats.ts:getMinioStats()` lists every object in every bucket on every Home page render. Fine to ~10k objects, sluggish at 100k+, painful at 1M+.

- **Hits when:** the storage layer actually has tens of thousands of objects.
- **Cheap fix:** cache the result in `globalThis` with a 60s TTL, refreshed in the background.
- **Better fix:** wrap the capacity section in a `<Suspense>` boundary so resource counts paint immediately and capacity streams in.

---

## Latent / operational

### `postgres/init/*.sql` is behind `postgres/migrations/*.sql`
Fresh installs run the init scripts on first boot. The init scripts only seed v0.1.0 schema (extensions, roles, audit, sample, buckets, auth). Migrations 0005–0013 add realtime, functions, function_env, function_env_encryption, cron jobs, audit retention, and the `pg_read_all_stats` grant — none of which are in init.

- **Result:** a fresh install ends up with a less complete schema than an upgraded one. The user hit this when `_dashboard.cron_jobs` was missing.
- **Fix:** backport the migrated tables into new init files (`07_realtime.sql`, `08_functions.sql`, `09_cron_jobs.sql`, etc.) so fresh installs converge. Migrations stay idempotent and become no-ops on fresh installs.
- **`UPDATE-BEHIND-APPS01.md:196` already claims this is true — fixing the gap brings the docs back in line.**

### Caddy routing for `/functions/v1/*`
Edge functions live on the `dashboard.*` host. External callers expect them under `api.*` (Supabase convention, what the function-author template hints at). Currently a 404 if you hit `api.example.com/functions/v1/<name>`.

- **Fix:** Caddyfile `handle /functions/v1/*` block on the API host that reverse_proxies to `dashboard:3000`. Dashboard middleware (`middleware.ts:29-31`) already lets `/functions/v1/*` through without a session.

### PostgREST schema-cache reload
`PGRST_DB_CHANNEL_ENABLED=false` (required for PgBouncer transaction mode) means PostgREST no longer auto-detects schema changes.

- **Workaround today:** `docker compose restart postgrest` after DDL.
- **Better fix:** an admin button in the dashboard ("Reload PostgREST schema cache") that issues `NOTIFY pgrst, '"reload"'` over the dashboard's direct connection to Postgres (the dashboard talks to PgBouncer normally, but `pool()` could be swapped for `realtimePool()` for this one NOTIFY since LISTEN/NOTIFY don't need session pinning for a one-shot publish).

### Audit retention applies to the database only
The 30-day prune wipes rows from `_dashboard.audit_log`. The on-disk JSONL files at `${AUDIT_LOG_DIR}/<subdir>/audit-YYYY-MM-DD.jsonl` are never deleted by us.

- **Intentional today:** the files are the long-term archive.
- **Add later if needed:** a separate `audit_files_retention_days` setting and matching prune step, mirroring the DB one.

### Password rotation procedure
Older installs may have base64-generated passwords containing `/` or `+`, which break URL-form Postgres connection strings (we hit this on `AUTHENTICATOR_PASSWORD`).

- **README** now recommends `openssl rand -hex 24` to prevent it on fresh installs.
- **Missing:** a documented rotation procedure for existing installs (`ALTER ROLE … WITH PASSWORD …`; update `.env`; restart `pgbouncer` + `postgrest` + `dashboard`).

---

## Code quality / minor

### Next.js 16 middleware deprecation
Dev server emits: *"The 'middleware' file convention is deprecated. Please use 'proxy' instead."*

- **Fix:** rename `dashboard/middleware.ts` → `dashboard/proxy.ts`. Confirm Next 16's proxy convention is API-compatible (it appears to be — same `NextRequest`, same `NextResponse`).

### `serverActions` experimental flag
Next prints a warning that server actions are an experiment. Stable in Next 15+; the flag may already be unneeded — check `dashboard/next.config.ts`.

### Load testing
Everything in the recent perf pass (pool bumps, PgBouncer, function compile cache) was speculative — sized for "1000+ users". We have not actually load-tested.

- **Before optimising further:** run `oha`, `wrk`, or `k6` against `api.*` (PostgREST), `dashboard.*/functions/v1/<fn>` (edge functions), and `dashboard.*/auth/v1/*` (end-user auth). Find the real bottleneck, then fix it.
