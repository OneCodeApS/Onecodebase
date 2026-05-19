#!/usr/bin/env bash
# Manual deploy script — runs on the server.
#
# Usage:
#   ./scripts/deploy.sh           # deploy `latest`
#   ./scripts/deploy.sh <sha>     # deploy a specific commit, e.g. for rollback
#
# Assumes:
#   - The repo is checked out at /opt/onecodebase (or wherever you put it).
#   - `.env` exists at the repo root with GHCR_OWNER and all other vars set.
#   - You've already run `docker login ghcr.io` once on this machine with a PAT
#     that has `read:packages` scope (creds are cached in ~/.docker/config.json).

set -euo pipefail

TAG="${1:-latest}"

# Run from the repo root regardless of where the script is invoked from.
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

if [ ! -f .env ]; then
	echo "ERROR: .env missing at $REPO_ROOT/.env" >&2
	exit 1
fi

echo "==> Updating repo (compose / caddy / postgres init files)"
git pull --ff-only

echo "==> Pinning DASHBOARD_IMAGE_TAG=$TAG in .env"
# Atomic rewrite — if the script dies mid-edit, .env is never half-written.
grep -v '^DASHBOARD_IMAGE_TAG=' .env > .env.tmp || true
echo "DASHBOARD_IMAGE_TAG=$TAG" >> .env.tmp
mv .env.tmp .env

COMPOSE=(docker compose -f docker-compose.yml -f docker-compose.prod.yml)

echo "==> Pulling dashboard image"
"${COMPOSE[@]}" pull dashboard

# Only the dashboard is recreated. --no-deps prevents any other service from
# being touched (most importantly Postgres). --wait blocks until the new
# container is healthy, so this script exits non-zero on a failed deploy.
echo "==> Restarting dashboard (Postgres / MinIO / Caddy untouched)"
"${COMPOSE[@]}" up -d --no-deps --wait dashboard

echo "==> Pruning dangling images"
docker image prune -f >/dev/null

echo
echo "Deploy complete: dashboard now running tag '$TAG'"
"${COMPOSE[@]}" ps
