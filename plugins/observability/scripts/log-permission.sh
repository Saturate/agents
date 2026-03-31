#!/bin/bash
#
# Permission request logger for Claude Code hooks.
# Handles PermissionRequest events.
# Writes to ~/.claude/logs/permissions-YYYY-MM-DD.jsonl
#
# Never blocks — always exits 0.

source "$(dirname "$0")/lib.sh"

[ "$HOOK_EVENT" = "PermissionRequest" ] || exit 0

TIMESTAMP=$(utc_timestamp)
TOOL_NAME=$(hook_field tool_name)

ENTRY=$(jq -cn \
  --arg ts "$TIMESTAMP" \
  --arg ev "permission" \
  --arg sid "$SESSION_ID" \
  --arg project "$PROJECT" \
  --arg tool_name "$TOOL_NAME" \
  '{timestamp: $ts, event: $ev, session_id: $sid, project: $project, tool_name: $tool_name}')

log_entry "permissions" "$ENTRY"

push_loki "$(jq -cn \
  --arg source "claude-code" \
  --arg event "permission" \
  --arg tool_name "$TOOL_NAME" \
  --arg project "$PROJECT" \
  '{source: $source, event: $event, tool_name: $tool_name, project: $project}')" "$ENTRY"

exit 0
