#!/bin/bash
#
# Stop failure logger for Claude Code hooks.
# Handles StopFailure events (API errors that kill a turn).
# Writes to ~/.claude/logs/turns-YYYY-MM-DD.jsonl
#
# Never blocks — always exits 0.

source "$(dirname "$0")/lib.sh"

[ "$HOOK_EVENT" = "StopFailure" ] || exit 0

TIMESTAMP=$(utc_timestamp)

ENTRY=$(jq -cn \
  --arg ts "$TIMESTAMP" \
  --arg ev "stop_failure" \
  --arg sid "$SESSION_ID" \
  --arg project "$PROJECT" \
  '{timestamp: $ts, event: $ev, session_id: $sid, project: $project}')

EXTRA=$(jq -c 'del(.hook_event_name, .session_id, .cwd, .transcript_path)' < "$_HOOK_INPUT_FILE" 2>/dev/null)
if [ -n "$EXTRA" ] && [ "$EXTRA" != "{}" ]; then
  ENTRY=$(echo "$ENTRY" | jq -c --argjson extra "$EXTRA" '. + {details: $extra}')
fi

emit_event "turns" "$ENTRY" "$(jq -cn \
  --arg source "claude-code" \
  --arg event "stop_failure" \
  --arg project "$PROJECT" \
  '{source: $source, event: $event, project: $project}')"

exit 0
