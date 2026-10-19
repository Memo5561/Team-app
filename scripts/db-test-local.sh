#!/usr/bin/env bash
# Applies supabase/migrations + seed to a throwaway local PostgreSQL cluster and runs the pgTAP
# tests in supabase/tests/database. Fallback for environments where the Supabase Docker images
# cannot be pulled (e.g. restricted cloud sessions). CI runs `supabase test db` against the real
# Supabase image and remains authoritative; see scripts/local-db/supabase-shim.sql for the shim.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PG_BIN="${PG_BIN:-$(find /usr/lib/postgresql -maxdepth 2 -name bin -type d 2>/dev/null | sort -V | tail -n 1)}"
PORT="${LOCAL_DB_PORT:-54329}"

if [[ -z "$PG_BIN" || ! -x "$PG_BIN/initdb" ]]; then
  echo "PostgreSQL server binaries not found. Install postgresql or set PG_BIN." >&2
  exit 1
fi
if [[ ! -f "$("$PG_BIN/pg_config" --sharedir)/extension/pgtap.control" ]]; then
  echo "pgTAP is not installed (e.g. apt-get install postgresql-$("$PG_BIN/pg_config" --version | grep -oE '[0-9]+' | head -n 1)-pgtap)." >&2
  exit 1
fi

WORK="$(mktemp -d)"
chmod 755 "$WORK"

# initdb/postgres refuse to run as root; only the server runs as the postgres user.
as_server_user() {
  if [[ "$(id -u)" -eq 0 ]]; then runuser -u postgres -- "$@"; else "$@"; fi
}
if [[ "$(id -u)" -eq 0 ]]; then chown postgres "$WORK"; fi

cleanup() {
  as_server_user "$PG_BIN/pg_ctl" -D "$WORK/data" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$WORK"
}
trap cleanup EXIT

as_server_user "$PG_BIN/initdb" -D "$WORK/data" -U postgres --auth=trust --no-sync -E UTF8 >/dev/null
as_server_user "$PG_BIN/pg_ctl" -D "$WORK/data" -l "$WORK/postgres.log" -w \
  -o "-k $WORK -p $PORT -c listen_addresses=''" start >/dev/null

psql_run() {
  "$PG_BIN/psql" -X -q -v ON_ERROR_STOP=1 -h "$WORK" -p "$PORT" -U postgres -d postgres "$@"
}

psql_run -f "$ROOT/scripts/local-db/supabase-shim.sql"
for migration in "$ROOT"/supabase/migrations/*.sql; do
  echo "migrate  $(basename "$migration")"
  psql_run -f "$migration"
done
psql_run -f "$ROOT/supabase/seed.sql"

failed=0
for test_file in "$ROOT"/supabase/tests/database/*.test.sql; do
  name="$(basename "$test_file")"
  if ! output="$(psql_run -t -A -f "$test_file" 2>&1)"; then
    printf '%s\nFAIL     %s (SQL error)\n' "$output" "$name"
    failed=1
  elif grep -qE '^(not ok|# Looks like)' <<<"$output"; then
    printf '%s\nFAIL     %s\n' "$output" "$name"
    failed=1
  else
    echo "ok       $name ($(grep -c '^ok' <<<"$output") assertions)"
  fi
done

exit "$failed"
