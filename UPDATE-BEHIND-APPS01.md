# Updating Onecodebase (behind APPS01)

For servers deployed using [`DEPLOY-BEHIND-APPS01.md`](./DEPLOY-BEHIND-APPS01.md). Updates replace only the dashboard container — Postgres, MinIO, Caddy, and your data are untouched.

## Before you start

1. **Find the new version.** Open [Releases](https://github.com/OneCodeApS/Onecodebase/releases) and note the version, e.g. `0.2.0`.
2. **Read the release notes.** Look for anything marked **BREAKING** in `CHANGELOG.md` for that version and follow any migration steps before continuing.

## One-time setup on each app server (skip if already done)

If this server has only ever been deployed once with the manual `docker compose ... up -d` (as the first-deploy guide does), tell git to ignore the local `Caddyfile` mod so future `git pull`s don't conflict:

```bash
cd /opt/onecodebase
git checkout master
git update-index --skip-worktree caddy/Caddyfile
```

After this, `scripts/deploy.sh` works cleanly.

## Update

SSH to the app server, then:

```bash
cd /opt/onecodebase
./scripts/deploy.sh 0.2.0
```

The script:

1. `git pull --ff-only` — pulls any updated compose / Postgres init files. (Won't touch your `Caddyfile` because of `skip-worktree`.)
2. Pins `DASHBOARD_IMAGE_TAG=0.2.0` in `.env`.
3. Pulls `ghcr.io/onecodeaps/onecodebase-dashboard:0.2.0` from GHCR.
4. Recreates **only** the dashboard container (`--no-deps`) and waits until it's healthy (`--wait`).
5. Prunes dangling images.

If the new image fails to become healthy, the script exits non-zero and the previous container keeps serving traffic — your users won't notice a failed deploy.

If `scripts/deploy.sh` errors with `Permission denied`, run via bash:

```bash
bash scripts/deploy.sh 0.2.0
```

## Verify

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps
```

The dashboard line should read `Up X seconds (healthy)` and show the new image tag.

Open the dashboard in your browser, sign in — your existing admin still works; the data volume is preserved.

## Rollback

Every release is an immutable image tag. To revert:

```bash
./scripts/deploy.sh 0.1.0
```

The dashboard container is replaced with the older image. Database, MinIO storage, and Caddy certs are untouched.

> If the version you're rolling back from changed the database schema, the older dashboard may not work against the newer schema. Check the CHANGELOG for **BREAKING** notes before rolling back across a schema migration — you may need to restore from a DB backup as well.

## Manual update (fallback)

If `scripts/deploy.sh` misbehaves for any reason, the same steps by hand:

```bash
cd /opt/onecodebase

# Pin the new version in .env
grep -v '^DASHBOARD_IMAGE_TAG=' .env > .env.tmp
echo "DASHBOARD_IMAGE_TAG=0.2.0" >> .env.tmp
mv .env.tmp .env

# Pull the new image
docker compose -f docker-compose.yml -f docker-compose.prod.yml pull dashboard

# Recreate just the dashboard container and wait for healthy
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --no-deps --wait dashboard

# Clean up old images
docker image prune -f
```

## Notes

- Updates are dashboard-only. Postgres / MinIO / Caddy upgrades are separate — those require version bumps in `docker-compose.yml` and an explicit `up -d` for the affected service.
- APPS01 doesn't need to change for a Onecodebase version update. Its site file already proxies by hostname, regardless of which dashboard version is running behind it.
- The `postgres/init/*.sql` scripts only run on a fresh DB. Schema changes ship as migrations bundled with each release — the dashboard runs them automatically on startup (when the project ships migrations; see CHANGELOG for which version introduces them).
