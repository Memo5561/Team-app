#!/bin/bash
set -euo pipefail

# Only run in Claude Code cloud sessions
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

# Install graphify CLI (PyPI package name is "graphifyy")
if ! command -v graphify >/dev/null 2>&1; then
  pip install --quiet graphifyy
fi

# Install the /graphify skill for Claude Code
if [ ! -f "$HOME/.claude/skills/graphify/SKILL.md" ]; then
  graphify install --platform claude
fi

# Project dependencies, so lint, typecheck and tests run without manual setup.
if [ -f "$CLAUDE_PROJECT_DIR/package.json" ] && command -v pnpm >/dev/null 2>&1; then
  (cd "$CLAUDE_PROJECT_DIR" && pnpm install --frozen-lockfile --reporter=silent) ||
    echo "session-start: pnpm install failed" >&2
fi

# pgTAP for `pnpm db:test:local` (cloud sessions cannot pull the Supabase Docker images).
PG_MAJOR="$(ls /usr/lib/postgresql 2>/dev/null | sort -V | tail -n 1 || true)"
if [ -n "$PG_MAJOR" ] && [ ! -f "/usr/share/postgresql/$PG_MAJOR/extension/pgtap.control" ]; then
  (apt-get update -qq && apt-get install -y -qq --no-install-recommends "postgresql-$PG_MAJOR-pgtap") >/dev/null 2>&1 ||
    echo "session-start: pgTAP install failed" >&2
fi
