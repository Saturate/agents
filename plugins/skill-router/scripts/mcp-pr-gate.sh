#!/bin/bash
#
# PreToolUse gate for MCP PR creation tools.
#
# Blocks mcp__*__repo_create_pull_request and redirects to the make-pr
# skill, which uses CLI commands (gh/az) that are properly gated via
# the SKILL_ACK mechanism in skill-advisor.sh.
#
# MCP tools can't carry a SKILL_ACK prefix, so this gate has no unlock
# path — the model must use the CLI-based make-pr skill instead.

set -uo pipefail

command -v jq >/dev/null 2>&1 || exit 0

if [ -t 0 ]; then
  exit 0
fi
INPUT=$(cat)

TOOL_NAME=$(printf '%s' "$INPUT" | jq -r '.tool_name // empty' 2>/dev/null)

case "$TOOL_NAME" in
  *repo_create_pull_request*)
    jq -cn '{ decision: "block", reason: "Do not create PRs via MCP tools. Invoke the `/make-pr` skill instead — it uses CLI commands with proper gating, generates context-aware descriptions, and confirms with the user before posting." }'
    ;;
esac

exit 0
