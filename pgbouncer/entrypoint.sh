#!/bin/sh
# Generate pgbouncer.ini and userlist.txt from env vars on every start.
# Idempotent: rewrites both files each time so password rotation just
# requires a container restart.
set -eu

: "${AUTHENTICATOR_PASSWORD:?AUTHENTICATOR_PASSWORD must be set}"
: "${DASHBOARD_ADMIN_PASSWORD:?DASHBOARD_ADMIN_PASSWORD must be set}"

PG_DB="${POSTGRES_DB:-postgres}"
PG_HOST="${POSTGRES_HOST:-postgres}"
PG_PORT="${POSTGRES_PORT:-5432}"

# Tunables — kept here rather than in a static .ini so a deploy can override
# without rebuilding the image. Defaults assume one PgBouncer in front of one
# Postgres (the current compose topology); raise default_pool_size before
# raising the dashboard / PostgREST client pool sizes.
POOL_MODE="${POOL_MODE:-transaction}"
MAX_CLIENT_CONN="${MAX_CLIENT_CONN:-1000}"
DEFAULT_POOL_SIZE="${DEFAULT_POOL_SIZE:-30}"
RESERVE_POOL_SIZE="${RESERVE_POOL_SIZE:-5}"
RESERVE_POOL_TIMEOUT="${RESERVE_POOL_TIMEOUT:-3}"
SERVER_IDLE_TIMEOUT="${SERVER_IDLE_TIMEOUT:-60}"

umask 077

# Plain auth = clients send plaintext password and PgBouncer compares against
# this file. PgBouncer uses the same plaintext to do SCRAM with Postgres.
# Safe in this topology because traffic between clients and PgBouncer never
# leaves the Docker bridge network (no public ingress to :6432).
cat > /etc/pgbouncer/userlist.txt <<EOF
"authenticator" "${AUTHENTICATOR_PASSWORD}"
"dashboard_admin" "${DASHBOARD_ADMIN_PASSWORD}"
EOF

cat > /etc/pgbouncer/pgbouncer.ini <<EOF
[databases]
${PG_DB} = host=${PG_HOST} port=${PG_PORT} dbname=${PG_DB}

[pgbouncer]
listen_addr = 0.0.0.0
listen_port = 6432
unix_socket_dir =

auth_type = plain
auth_file = /etc/pgbouncer/userlist.txt

pool_mode = ${POOL_MODE}
max_client_conn = ${MAX_CLIENT_CONN}
default_pool_size = ${DEFAULT_POOL_SIZE}
reserve_pool_size = ${RESERVE_POOL_SIZE}
reserve_pool_timeout = ${RESERVE_POOL_TIMEOUT}
server_idle_timeout = ${SERVER_IDLE_TIMEOUT}

# Clean session state between transactions so transaction-mode pooling
# doesn't leak SET / temp tables / prepared statements across clients.
server_reset_query = DISCARD ALL

# Lets PostgREST and pg's Node driver send extra_float_digits in the startup
# packet without PgBouncer rejecting it.
ignore_startup_parameters = extra_float_digits

# Required when running unprivileged on Alpine — pidfile lives in the
# writable runtime dir, not /var/run/pgbouncer (read-only in some setups).
pidfile = /var/run/pgbouncer/pgbouncer.pid

admin_users = dashboard_admin
stats_users = dashboard_admin

# Quiet logs (one line per (dis)connection is plenty; queries are not logged
# at all to avoid leaking statements with literals).
log_connections = 0
log_disconnections = 0
log_pooler_errors = 1
verbose = 0
EOF

exec "$@"
