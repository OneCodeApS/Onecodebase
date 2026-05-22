# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

While the project is on `0.x`, minor version bumps (`0.1 → 0.2`) may include breaking changes; patch versions (`0.1.0 → 0.1.1`) will not.

## [Unreleased]

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

[Unreleased]: https://github.com/OneCodeApS/Onecodebase/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/OneCodeApS/Onecodebase/releases/tag/v1.0.0
[0.1.0]: https://github.com/OneCodeApS/Onecodebase/releases/tag/v0.1.0
