#!/usr/bin/env bash
# Dump the whole Postgres cluster (every database + all roles/passwords) to a
# gzipped file on the host. This is the backup to take before ANY risky DB
# operation — most importantly a major-version upgrade (pg-major-upgrade.sh
# calls this automatically).
#
# Usage:
#   ./scripts/pg-backup.sh                 # → ./backups/<project>-pg<major>-<ts>.sql.gz
#   ./scripts/pg-backup.sh /some/other/dir # write into a different directory
#
# Progress is printed to stderr; the final backup path is printed to stdout
# (so other scripts can capture it with: BACKUP="$(./scripts/pg-backup.sh)").
#
# Requires the `postgres` service to be running.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

log() { echo "$@" >&2; }
err() { echo "ERROR: $*" >&2; exit 1; }

# Base compose only: these DB operations don't need the prod override (which
# would also demand GHCR_OWNER), and the running container is the same either
# way — `exec` attaches by project+service name.
COMPOSE=(docker compose -f docker-compose.yml)

command -v docker >/dev/null || err "docker not found"
[ -f .env ] || err ".env missing at $REPO_ROOT/.env"

# Read a single key out of .env without sourcing the whole file.
read_env() { grep -E "^$1=" .env 2>/dev/null | head -1 | cut -d= -f2- ; }
PGUSER="$(read_env POSTGRES_USER)"; PGUSER="${PGUSER:-postgres}"

"${COMPOSE[@]}" ps --status running --services 2>/dev/null | grep -qx postgres \
  || err "the 'postgres' service isn't running — start the stack first."

OUT_DIR="${1:-$REPO_ROOT/backups}"
mkdir -p "$OUT_DIR"

# Stamp the major version into the filename so it's obvious which server major
# a dump came from (and can restore into).
PG_MAJOR="$("${COMPOSE[@]}" exec -T postgres psql -U "$PGUSER" -tAc 'SHOW server_version_num' | cut -c1-2)"
PROJECT="$("${COMPOSE[@]}" config 2>/dev/null | awk '/^name:/{print $2; exit}')"
TS="$(date +%Y%m%d-%H%M%S)"
OUT="$OUT_DIR/${PROJECT:-onecodebase}-pg${PG_MAJOR}-${TS}.sql.gz"

log "==> Dumping cluster (pg_dumpall, role '$PGUSER') → $OUT"
# No --clean: a restore into a fresh cluster stays additive, and a restore into
# a populated one fails loudly rather than silently dropping objects.
"${COMPOSE[@]}" exec -T postgres pg_dumpall -U "$PGUSER" | gzip > "$OUT"

SIZE="$(wc -c < "$OUT")"
[ "$SIZE" -ge 1000 ] || { rm -f "$OUT"; err "backup looks suspiciously small (${SIZE} bytes) — aborting."; }

log "==> Backup OK ($(du -h "$OUT" | cut -f1))"
echo "$OUT"
