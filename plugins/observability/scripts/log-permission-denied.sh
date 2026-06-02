#!/bin/bash
#
# Permission denied logger for Claude Code hooks.
# Handles PermissionDenied events.
# Writes to ~/.claude/logs/permissions-YYYY-MM-DD.jsonl
#
# Never blocks — always exits 0.

source "$(dirname "$0")/lib.sh"

[ "$HOOK_EVENT" = "PermissionDenied" ] || exit 0

TIMESTAMP=$(utc_timestamp)
TOOL_NAME=$(hook_field tool_name)

ENTRY=$(jq -cn \
  --arg ts "$TIMESTAMP" \
  --arg ev "permission_denied" \
  --arg sid "$SESSION_ID" \
  --arg project "$PROJECT" \
  --arg tool_name "$TOOL_NAME" \
  '{timestamp: $ts, event: $ev, session_id: $sid, project: $project, tool_name: $tool_name}')

EXTRA=$(jq -c 'del(.hook_event_name, .session_id, .cwd, .transcript_path, .tool_name)' < "$_HOOK_INPUT_FILE" 2>/dev/null)
if [ -n "$EXTRA" ] && [ "$EXTRA" != "{}" ]; then
  ENTRY=$(echo "$ENTRY" | jq -c --argjson extra "$EXTRA" '. + {details: $extra}')
fi

emit_event "permissions" "$ENTRY" "$(jq -cn \
  --arg source "claude-code" \
  --arg event "permission_denied" \
  --arg tool_name "$TOOL_NAME" \
  --arg project "$PROJECT" \
  '{source: $source, event: $event, tool_name: $tool_name, project: $project}')"

exit 0
