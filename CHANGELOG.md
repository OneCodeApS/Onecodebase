# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

While the project is on `0.x`, minor version bumps (`0.1 → 0.2`) may include breaking changes; patch versions (`0.1.0 → 0.1.1`) will not.

## [Unreleased]

## [1.3.2] - 2026-05-27

CORS allowed-origins are now managed from the dashboard instead of only the `AUTH_ALLOWED_ORIGINS` env var.

### Added

- **CORS origins admin page** — Authentication → CORS origins. Add/remove the browser origins allowed to read responses from `/auth/v1/*` and the storage URL-issuance endpoints. Input is validated and canonicalized (via `URL.origin`, dropping any path/trailing slash; `*` is accepted for "any origin"), a `*` entry shows a warning, and every change writes an audit row (`settings.cors_origins.add` / `settings.cors_origins.remove`). Admin-gated like the other `/admin/*` pages.

### Changed

- **CORS allowlist is now database-backed** — `lib/cors.ts` reads the `auth_allowed_origins` setting (cached in-process for 30s, invalidated immediately on save) and falls back to the `AUTH_ALLOWED_ORIGINS` env var only until the list is first saved from the UI. After that the database is authoritative — even an empty list (explicit "allow nothing"); a DB error falls back to the env var rather than blocking requests. No migration: the setting row is created on first save, so existing env-configured installs keep working until then.

## [1.3.1] - 2026-05-27

### Added

Admin Role can now be given to dashboard users

## [1.3.0] - 2026-05-26

Public APIs consolidated under a single `api.*` host, end-user auth gets CORS, storage moves out from under its own subdomain to `api.*/storage/v1/object/*` (Caddy strips the prefix and forwards directly to MinIO — no Node in the byte path, so large videos and Range requests scale with MinIO bandwidth). Operator console gains the version chip, system-schema toggle in the tables browser, and reusable Loader / RefreshButton components.

### Added

- **Public API consolidation under `api.*`** — `/rest/v1/<table>` (PostgREST tables), `/rpc/v1/<fn>` (PostgREST RPC), `/auth/v1/*` (end-user auth), `/realtime` (SSE), `/functions/v1/<name>` (edge functions), and `/storage/v1/object/*` (storage proxy) all live on the api host. `dashboard.*` returns 404 for the API paths so there's one canonical surface for clients, docs, and CORS.
- **CORS at `lib/cors.ts`** — `withCors(handler, { methods })` adds `Access-Control-*` headers; `corsPreflight({ methods })` handles OPTIONS. Origin allowlist driven by new `AUTH_ALLOWED_ORIGINS` env var (empty / `*` / comma-separated origins). Applied to every `/auth/v1/*` route and the storage URL-issuance endpoints. Non-browser callers (curl, server-to-server) ignore CORS and keep working regardless of the setting.
- **Storage URL-issuance endpoints** — `POST /storage/v1/object/sign/<bucket>/<key>` returns a short-lived SigV4 GET URL; `POST /storage/v1/object/sign-batch` mints up to 100 in one call (for galleries); `POST /storage/v1/object/upload/<bucket>/<key>` validates bucket policy (max size, MIME allowlist) and returns a 5-minute presigned PUT. JWT-gated (authenticated or service_role).
- **System-schema toggle in the tables browser** — `_dashboard` and `auth` schemas are hidden by default; a "Show system schemas" checkbox in the sidebar reveals them and persists to localStorage. When a system schema is active, the sidebar shows a "Read-only · use the admin UI" pill; the row viewer shows a banner linking to the dedicated admin page (Dashboard users, End users, Audit log, Edge functions, Cron jobs, Storage buckets, Auth providers). SQL editor stays unrestricted as the escape hatch.
- **Reusable Loader / RefreshButton components** — `<Loader size="…" label="…" />` for inline spinners (drops into buttons or table cells); `<LoaderBlock />` for centered card-level loading; `<RefreshButton onRefresh?={…} />` calls `router.refresh()` inside a `useTransition` so server-rendered pages re-fetch with visible pending state. `tables/[name]/loading.tsx` wires up the Suspense fallback so the spinner shows on navigation, pagination, schema switches, and refresh.
- **Dashboard version chip in the sidebar** — `v<package.json#version>` rendered next to the "Onecodebase" header.

### Changed

- **Storage architecture: Caddy strip-and-forward** — `/storage/v1/object/*` is matched by Caddy on the api host. The three URL-issuance prefixes (`/sign/*`, `/sign-batch`, `/upload/*`) go to the dashboard; everything else under `/storage/v1/object/*` strips the prefix and forwards to internal MinIO. `header_up Host {host}` preserves the original Host header so SigV4 verifies against the same hostname the SDK signed. Bytes never traverse Node; HTTP Range requests / video seeking work natively because MinIO handles them.
- **`getShareLink` returns api-host URLs** — public buckets get `api.<host>/storage/v1/object/<bucket>/<key>` (no query; MinIO's anonymous-read ACL serves them); private buckets get the same path with a SigV4 query string. Caddy strips the prefix before MinIO sees the request, so signatures verify.
- **Sidebar scroll lock** — `(app)/layout.tsx` uses `h-screen overflow-hidden` (was `min-h-screen`) and `<main>` is the only scroll context, so long tables don't push the sidebar off-screen.
- **`FUNCTION_ENV_KEY` and `API_PUBLIC_URL` forwarded to the dashboard container** — both were latent bugs. `FUNCTION_ENV_KEY` was added in v1.0.0 but never wired through `docker-compose.yml`, so encrypted-env reads would have failed in a containerized install with a missing-key error. `API_PUBLIC_URL` is needed by `lib/minio.ts` to know which endpoint to sign storage URLs against.
- **MinIO `MINIO_BROWSER_REDIRECT_URL`** — now derived from `DASHBOARD_PUBLIC_URL` instead of `MINIO_PUBLIC_URL` (MinIO's console isn't publicly exposed and the old env var is gone).

### Removed

- **`files.*` hostname** — Caddy block and DNS record both retired. MinIO is internal-only, reached exclusively through `api.*/storage/v1/object/*`.
- **`FILES_HOST` and `MINIO_PUBLIC_URL` env vars** — gone from `.env.example`, `docker-compose.yml`, and both deployment guides.
- **Dead helpers** — `lib/minio.ts:minioPublicBaseUrl()` and `lib/storage.ts:publicReadPolicy()` (briefly removed earlier in this cycle, then restored when the visibility mirror returned); the abandoned `lib/storage-signing.ts` HMAC scheme that the first storage-proxy iteration used.

### Breaking

- **All public API URLs moved to `api.*` with new prefixes.** Tables at `https://api.<host>/<table>` → `https://api.<host>/rest/v1/<table>`. The same applies to RPC, auth, realtime, functions, and storage. Clients pointed at the old paths will 404. `dashboard.<host>` returns 404 for those paths now (used to forward them to the dashboard process); update any internal callers.
- **`files.<host>` is gone.** Existing presigned URLs from v1.2.0 stop resolving after the Caddy reload. The dashboard's Share button reissues against the new host; rerun any pinned share links you want to keep.
- **Public buckets need their MinIO ACL re-saved once.** The v1.2.0 → v1.3.0 churn intentionally cleared MinIO's anonymous-read policy mid-transition, then put it back in the final design. Open each public bucket's policy modal once and click Save — the dashboard re-mirrors the ACL, no other action needed.
- **`AUTH_ALLOWED_ORIGINS` is empty by default.** Browser apps from any cross-origin host will be blocked by CORS until this is set (`*` for local dev, explicit origin list for production). Non-browser clients (curl, server-to-server) work without it.
- **`FUNCTION_ENV_KEY` is now required at container start.** Existing installs that worked through v1.2.0 by chance (the env key wasn't enforced) will now fail to start the dashboard container until the key is in `.env`. Generate with `openssl rand -hex 32`.

## [1.2.0] - 2026-05-26

Design refresh for the login page.

### Changed

- **Login page redesign** — visual overhaul of `/login`. Layout, typography, and form styling refreshed; supporting UI extracted into `dashboard/app/login/_components/` for reuse and clarity.

## [1.1.0] - 2026-05-22

Operability + performance pass. The home page now gives admins a live overview, audit-log growth is bounded by a configurable retention window, deletes go through a single confirmation modal, and the data path is sized for a few hundred concurrent users via connection pooling + edge-function compile caching.

### Added

- **Edge function JWT gate** — new `verify_jwt` flag on `_dashboard.functions`, default ON. When on, `/functions/v1/<name>` requires a valid JWT signed with `PGRST_JWT_SECRET` (the same secret PostgREST uses). Accepts `Authorization: Bearer <token>`, the `apikey:` header (Supabase-client convention), or `?token=` for `EventSource`-style callers. Missing or invalid tokens get `401` with an audit row. The function receives the verified claims as `ctx.user = { id, email, role }` (each nullable) — `role` is the discriminator (`"anon"` / `"authenticated"` / `"service_role"`). Cron-triggered runs bypass the gate (they never enter the HTTP route).
- **API keys page** — `/admin/api-keys`. Renders the anon key (always visible) and the service-role key (masked behind a Reveal button) with copy buttons and inline guidance on which to use where. Both keys are deterministic JWTs derived from `PGRST_JWT_SECRET` (no `iat`, fixed `exp` of 2100-01-01) so they're stable across restarts. Every page visit writes an `api_keys.view` audit row.
- **Home overview** — admin-only Resource counts (tables, storage objects, edge functions, cron jobs, end users, audit rows), Server capacity used (database size, object storage, audit JSONL files), and live Database health (`pg_stat_activity` connections, cache hit ratio with colour-coded thresholds, longest active query).
- **Audit-log retention** — configurable from Admin → Audit settings. Defaults to 30 days. A daily in-process sweeper deletes rows older than `audit_retention_days`. Stores the last-deleted row's hash in `audit_chain_anchor` so the chain verifier still works on the retained window. Manual "Run prune now" button for ad-hoc runs.
- **Reusable confirm-delete modal** — `(app)/_components/ConfirmDeleteForm.tsx`. Replaces `window.confirm` + bare submit forms across cron jobs, function env vars, function "Danger zone", storage bucket / object, and end-user deletes. Each callsite has a tailored message about the side effects.
- **Cron schedule help** — small `?` icon next to the Schedule field in the cron-job modal expands an inline reference (field layout, operators, examples, UTC note).
- **Edge function trigger metadata** — every invocation (HTTP or cron-driven) writes one `function.invoke` audit row via a shared `auditInvocation` helper. New **Trigger** column on the invocations page shows `HTTP` or `cron: <job-name>`.
- **Server-side edge function syntax check** — `validateFunctionCode()` runs the same `new AsyncFunction(...)` compile step on save. Bad code is rejected with the SyntaxError, not silently stored.
- **PgBouncer service** — transaction-pool multiplexer in front of Postgres. PostgREST and the dashboard's general queries now route through `pgbouncer:6432`; realtime keeps a direct connection to Postgres for `LISTEN`. Image built from `pgbouncer/Dockerfile` (Alpine + the `pgbouncer` package); config generated from env vars at container start. Defaults: `pool_mode = transaction`, `default_pool_size = 30`, `max_client_conn = 1000`.
- **Realtime connection pool** — new `realtimePool()` in `lib/db.ts` bypasses PgBouncer (max 50, no statement timeout) so SSE `LISTEN` connections survive.
- **Edge function compile cache** — `getCompiled(fn)` keyed by `name + updated_at`. Repeat invocations skip the per-call `new AsyncFunction(...)` parse; edits bust the cache automatically via `updated_at = now()`.

### Changed

- **Connection pool sizes** — dashboard `pg.Pool max`: 10 → 30; `PGRST_DB_POOL`: 10 → 30.
- **Postgres `max_connections`** — 100 → 150 via the postgres service `command:` override. Postgres container recreates to pick this up.
- **PostgREST tuning for transaction pooling** — `PGRST_DB_PREPARED_STATEMENTS=false` (server-side prepared statements don't survive transaction pooling), `PGRST_DB_CHANNEL_ENABLED=false` (schema-cache reload via `LISTEN pgrst` doesn't either; restart PostgREST after DDL changes).
- **Password generation guidance in `README.md`** — `openssl rand -hex 24` instead of `openssl rand -base64 24`. Base64 can include `/` and `+`, both of which break URL-form Postgres connection strings.

### Database

- Migrations **0012** (`audit_retention_days = 30` seeded into `_dashboard.settings`), **0013** (`GRANT pg_read_all_stats TO dashboard_admin`, so the Home DB-health card can see all sessions), **0014** (`verify_jwt boolean DEFAULT true` on `_dashboard.functions`), and **0015** (`ALTER ROLE … SET statement_timeout = '30s'` for `dashboard_admin` and `authenticator`, since PgBouncer drops the client-side startup param). Applied in order via the existing major-upgrade flow.
- `postgres/init/03_audit_log.sql` and `02_roles.sql` mirror these for fresh installs.

### Security

- Edge function endpoints are no longer open by default. Existing functions retain whatever behaviour their code already implemented; the new `verify_jwt` toggle is on by default, so a fresh function won't accept anonymous calls without an admin explicitly opting it out.
- `PGRST_JWT_SECRET` is now passed to the dashboard container (latent bug — `/auth/v1/signin` and `/realtime` were both reading it via `process.env` but `docker-compose.yml`'s dashboard service was never forwarding it from `.env`).
- `pg_read_all_stats` is a built-in read-only stats privilege; it does not grant access to any data, only to `pg_stat_*` views.
- The audit chain verifier now seeds `expectedPrev` from `audit_chain_anchor` so retention pruning cannot silently truncate undetected — the anchor must match the oldest surviving row's `prev_hash`.

### Breaking

- **Edge functions now require a JWT by default.** All functions created before this release get `verify_jwt = true` from the migration's column default, so existing public endpoints will start returning `401 missing_token`. To restore the previous behaviour for a specific function, untick "Verify JWT" on its Overview tab. Clients that should keep working without changes should switch to sending the anon key (visible at `/admin/api-keys`) in the `apikey:` header.
- The new `pgbouncer` service means `scripts/deploy.sh` is **not** enough on existing servers — it runs `--no-deps`, which won't create new services or recreate `postgrest` / `postgres` with the new connection-string and command-line settings. First upgrade requires a full `docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d`.
- Recreating `postgres` triggers a few seconds of downtime. The `postgres-data` volume is preserved, so no data loss.
- After upgrade, **schema changes (new tables, columns) require `docker compose restart postgrest`** to refresh PostgREST's schema cache — auto-reload via `LISTEN` is disabled to be compatible with PgBouncer transaction mode.
- Any pre-existing `.env` with a `/` in `AUTHENTICATOR_PASSWORD` (older `openssl rand -base64 24` output) must be rotated. `ALTER ROLE authenticator WITH PASSWORD '<new>';` and update `.env`, then `docker compose up -d --force-recreate pgbouncer postgrest`.

## [1.0.0] - 2026-05-21

Dashboard milestone. Operator console now covers tables, SQL, storage, audit, end-user auth, realtime, edge functions, and cron — bringing the platform to feature parity with the core Supabase Studio surface.

### Added

- **Dashboard layout** — left sidebar, Supabase-style nested sub-sidebars on Tables, Storage, Functions; reusable `Card` panel surface; per-page max-widths and centering where appropriate.
- **Three-role user model** (`admin` / `read_write` / `read_only`) on dashboard operators, with middleware-enforced admin gating for `/admin/*` routes.
- **Tables browser** — schema picker covering every non-system schema, paginated row view with column types, sensitive-column masking for password hashes and refresh tokens.
- **SQL Editor** — CodeMirror with PostgreSQL highlighting, Ctrl/Cmd+Enter to run, role-gated (`read_only` restricted to SELECT/WITH/EXPLAIN/SHOW), snippet sidebar, audit logging of every statement.
- **Storage** — bucket browser sub-sidebar, per-bucket policy (visibility, max upload MB, MIME allowlist) mirrored to MinIO bucket policy, file detail side panel with preview (image/video/audio/PDF/text), Share button with presigned URLs for private buckets / direct URLs for public.
- **Audit log viewer** — paginated table with filters (actor / action / date / result) and a chain verifier that walks the SHA-256 chain and flags tampering.
- **End-user authentication** (`auth` schema) — email/password + Microsoft OAuth 2.0 / OIDC, JWT issuance signed with `PGRST_JWT_SECRET` (PostgREST accepts the same tokens), refresh-token rotation, identity linking across providers.
- **Auth providers page** — toggle providers on/off, configure Microsoft client ID/secret/tenant, view derived redirect URI + authority URL with copy buttons.
- **Email-provider policy** — minimum password length, password requirements (lowercase/uppercase/digits/symbols), HaveIBeenPwned k-anonymity leak check enforced at signup. Toggles persisted for upcoming features (secure email change, OTP) marked as "not enforced".
- **End users page** — list/disable/enable/delete/reset password for `auth.users` accounts; revokes active sessions on disable + password reset.
- **Realtime** — per-table pg_notify trigger toggled from `/admin/realtime`, SSE endpoint at `/realtime?schema=X&table=Y` (JWT-protected) with heartbeats and clean teardown.
- **Edge functions** — `_dashboard.functions` table, in-process JavaScript executor with timeout and audited invocations, function detail page with Overview / Code / Invocations / Logs tabs, CodeMirror JS editor with Ctrl/Cmd+S to save, public HTTP endpoint at `/functions/v1/<name>`. Capabilities: `req` (Web Request), `ctx.env`, `ctx.db.query`, `fetch`.
- **Encrypted environment variables** — global env vars at `/admin/functions/env`, AES-256-GCM stored in `auth.providers`-style ciphertext column, UI shows first-3-chars masked preview, edit modal never displays current value, ciphertext masked in the tables browser.
- **Cron jobs** — node-cron scheduler initialised via `instrumentation.ts`, per-job schedule + function binding, status / last-run / last-error tracked per job. Job invocations carry an `X-Cron-Trigger` header.

### Database

- Migrations 0001 → 0011 (users + audit, bucket policies, auth schema, auth settings, realtime, function env, function env encryption, cron jobs). The migration runner is unchanged; apply each in order on first upgrade.
- `dashboard_admin` granted `USAGE/CREATE` on `public` plus full table/sequence/function access with default privileges; `BYPASSRLS` so the operator console sees every row.

### Security

- Encryption at rest for global function env vars (AES-256-GCM, key from `FUNCTION_ENV_KEY`).
- Sensitive columns (`_dashboard.function_env.value*`, `_dashboard.users.password_hash`, `auth.users.encrypted_password`, `auth.sessions.refresh_token_hash`) are masked in the tables browser.
- Audit log records every state-change action (login, user CRUD, SQL run, storage policy / object change, function invoke / save, cron save, realtime toggle, etc.) with the hash chain extending across new actions.
- `audit_log.actor_id` removed from the hashed body — was unstable due to `ON DELETE SET NULL`; the immutable `actor` (email) is hashed instead.

### Breaking

- `_dashboard.admins` renamed to `_dashboard.users` with a new `role` column; existing rows are mapped during the 0001 migration (`admin` preserved, `guest` mapped to `read_only`). Hard-coded `guest` role removed.
- The dashboard's bundled Caddy is unchanged, but the project supports being fronted by an external reverse proxy (see `DEPLOY-BEHIND-APPS01.md`) — in that mode the Caddyfile is patched locally to serve plain HTTP only.

## [0.1.0] - 2026-05-19

First milestone. Auth + reverse proxy + sample API working end-to-end. No dashboard features yet.

### Added
- Docker Compose orchestration for Postgres 16, PostgREST, MinIO, Caddy, and the dashboard.
- Postgres init scripts: `pgcrypto`, four roles (`anon`, `authenticated`, `service_role`, `dashboard_admin` + `authenticator` for PostgREST), private `_dashboard` schema, audit log table, sample `todos` table with RLS (anon SELECT, authenticated INSERT).
- Caddy reverse proxy with TLS — `tls internal` for local `*.localhost` dev; ACME / Let's Encrypt in prod.
- Next.js 15 admin dashboard with `/login`, an authenticated landing page, iron-session-encrypted cookies, Argon2id password hashing via `@node-rs/argon2`, and audit logging of login / logout.
- Interactive admin bootstrap CLI: `npm run create-admin` (no plaintext password ever touches `.env`).
- Container `HEALTHCHECK` on the dashboard; `scripts/deploy.sh` uses `up -d --no-deps --wait dashboard` so Postgres / MinIO / Caddy are untouched on deploy.
- GitHub Actions workflow that builds the dashboard image and publishes it to GHCR with `:latest` + `:<short-sha>` on main and `:X.Y.Z` + `:X.Y` on version tags.
- `SECURITY.md` and AGPL-3.0 LICENSE.

### Security
- Hard role separation: `dashboard_admin` is **not** granted to `authenticator`, so the dashboard's broad-privilege DB role is unreachable through PostgREST.
- Session cookies are encrypted with `SESSION_SECRET` (≥32 chars enforced at module load).
- Server actions on `/login` enforce same-origin posts (Next.js built-in).

[Unreleased]: https://github.com/OneCodeApS/Onecodebase/compare/v1.3.2...HEAD
[1.3.2]: https://github.com/OneCodeApS/Onecodebase/releases/tag/v1.3.2
[1.3.1]: https://github.com/OneCodeApS/Onecodebase/releases/tag/v1.3.1
[1.3.0]: https://github.com/OneCodeApS/Onecodebase/releases/tag/v1.3.0
[1.2.0]: https://github.com/OneCodeApS/Onecodebase/releases/tag/v1.2.0
[1.1.0]: https://github.com/OneCodeApS/Onecodebase/releases/tag/v1.1.0
[1.0.0]: https://github.com/OneCodeApS/Onecodebase/releases/tag/v1.0.0
[0.1.0]: https://github.com/OneCodeApS/Onecodebase/releases/tag/v0.1.0
