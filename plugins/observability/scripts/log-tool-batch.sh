#!/bin/bash
#
# Tool batch logger for Claude Code hooks.
# Handles PostToolBatch events.
# Writes to ~/.claude/logs/tool-usage-YYYY-MM-DD.jsonl
#
# Never blocks — always exits 0.

source "$(dirname "$0")/lib.sh"

[ "$HOOK_EVENT" = "PostToolBatch" ] || exit 0

TIMESTAMP=$(utc_timestamp)

ENTRY=$(jq -cn \
  --arg ts "$TIMESTAMP" \
  --arg ev "tool_batch" \
  --arg sid "$SESSION_ID" \
  --arg project "$PROJECT" \
  '{timestamp: $ts, event: $ev, session_id: $sid, project: $project}')

EXTRA=$(jq -c 'del(.hook_event_name, .session_id, .cwd, .transcript_path)' < "$_HOOK_INPUT_FILE" 2>/dev/null)
if [ -n "$EXTRA" ] && [ "$EXTRA" != "{}" ]; then
  ENTRY=$(echo "$ENTRY" | jq -c --argjson extra "$EXTRA" '. + {details: $extra}')
fi

emit_event "tool-usage" "$ENTRY" "$(jq -cn \
  --arg source "claude-code" \
  --arg event "tool_batch" \
  --arg project "$PROJECT" \
  '{source: $source, event: $event, project: $project}')"

exit 0
