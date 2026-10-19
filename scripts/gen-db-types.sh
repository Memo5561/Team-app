#!/usr/bin/env bash
# Regenerates src/types/database.ts with the pinned Supabase CLI and formats it with Prettier.
# Default source: the local Supabase stack (`pnpm db:start`). Pass other CLI flags to use a
# different database, e.g. `--db-url <url>` (used by `pnpm db:types:local`).
# Writes via a temp file, so a CLI error message can never replace the committed types.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET="$ROOT/src/types/database.ts"
raw="$(mktemp)"
formatted="$(mktemp)"
trap 'rm -f "$raw" "$formatted"' EXIT

if [[ $# -eq 0 ]]; then set -- --local; fi

(cd "$ROOT" && pnpm exec supabase gen types typescript "$@" --schema public >"$raw")
(cd "$ROOT" && pnpm exec prettier --stdin-filepath src/types/database.ts <"$raw" >"$formatted")
mv "$formatted" "$TARGET"
echo "Updated src/types/database.ts"
