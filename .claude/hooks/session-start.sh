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
