#!/usr/bin/env bash
# Applies supabase/migrations + seed to a throwaway local PostgreSQL cluster and runs the pgTAP
# tests below supabase/tests. Fallback for environments where the Supabase Docker images cannot be
# pulled (e.g. restricted cloud sessions). CI runs `supabase test db` against the real Supabase
# image and remains authoritative; see scripts/local-db/supabase-shim.sql for what is emulated.
#
# Usage: db-test-local.sh            run all pgTAP tests
#        db-test-local.sh --types    regenerate src/types/database.ts instead (pinned Supabase CLI)
set -euo pipefail

MODE="test"
if [[ "${1:-}" == "--types" ]]; then MODE="types"; fi

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

# initdb/postgres refuse to run as root; only the server runs as the postgres OS user.
as_server_user() {
  if [[ "$(id -u)" -eq 0 ]]; then runuser -u postgres -- "$@"; else "$@"; fi
}
if [[ "$(id -u)" -eq 0 ]]; then chown postgres "$WORK"; fi

cleanup() {
  as_server_user "$PG_BIN/pg_ctl" -D "$WORK/data" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$WORK"
}
trap cleanup EXIT

# Like the Supabase image: the bootstrap superuser is supabase_admin, `postgres` is not a superuser.
as_server_user "$PG_BIN/initdb" -D "$WORK/data" -U supabase_admin --auth=trust --no-sync -E UTF8 >/dev/null
# Tests use a private Unix socket only; TCP on 127.0.0.1 is needed solely for the CLI type generator.
LISTEN="''"
if [[ "$MODE" == "types" ]]; then LISTEN="127.0.0.1"; fi
if ! as_server_user "$PG_BIN/pg_ctl" -D "$WORK/data" -l "$WORK/postgres.log" -w \
  -o "-k $WORK -p $PORT -c listen_addresses=$LISTEN" start >/dev/null; then
  cat "$WORK/postgres.log" >&2
  exit 1
fi

psql_as() {
  local role="$1"
  shift
  "$PG_BIN/psql" -X -q -v ON_ERROR_STOP=1 -h "$WORK" -p "$PORT" -U "$role" -d postgres "$@"
}

psql_as supabase_admin -f "$ROOT/scripts/local-db/supabase-shim.sql"
for migration in "$ROOT"/supabase/migrations/*.sql; do
  echo "migrate  $(basename "$migration")"
  psql_as postgres --single-transaction -f "$migration"
done
psql_as postgres --single-transaction -f "$ROOT/supabase/seed.sql"

if [[ "$MODE" == "types" ]]; then
  bash "$ROOT/scripts/gen-db-types.sh" --db-url "postgresql://postgres@127.0.0.1:$PORT/postgres?sslmode=disable"
  exit 0
fi

failed=0
while IFS= read -r test_file; do
  name="${test_file#"$ROOT/"}"
  if ! output="$(psql_as postgres -t -A -f "$test_file" 2>&1)"; then
    printf '%s\nFAIL     %s (SQL error)\n' "$output" "$name"
    failed=1
    continue
  fi
  planned="$(grep -oE '^1\.\.[0-9]+$' <<<"$output" | head -n 1 | cut -d. -f3 || true)"
  ran="$(grep -cE '^(ok|not ok) ' <<<"$output" || true)"
  if grep -qE '^(not ok|# Looks like)' <<<"$output"; then
    printf '%s\nFAIL     %s\n' "$output" "$name"
    failed=1
  elif [[ -z "$planned" || "$planned" != "$ran" ]]; then
    printf '%s\nFAIL     %s (planned %s, ran %s)\n' "$output" "$name" "${planned:-none}" "$ran"
    failed=1
  else
    echo "ok       $name ($ran assertions)"
  fi
done < <(find "$ROOT/supabase/tests" -type f \( -name '*.sql' -o -name '*.pg' \) | sort)

exit "$failed"
