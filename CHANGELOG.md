# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

While the project is on `0.x`, minor version bumps (`0.1 → 0.2`) may include breaking changes; patch versions (`0.1.0 → 0.1.1`) will not.

## [Unreleased]

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

[Unreleased]: https://github.com/OneCodeApS/Onecodebase/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/OneCodeApS/Onecodebase/releases/tag/v0.1.0
