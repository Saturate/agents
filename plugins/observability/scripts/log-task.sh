#!/bin/bash
#
# Task/teammate logger for Claude Code hooks.
# Handles TaskCompleted and TeammateIdle events.
# Writes to ~/.claude/logs/tasks-YYYY-MM-DD.jsonl
#
# Never blocks — always exits 0.

source "$(dirname "$0")/lib.sh"

case "$HOOK_EVENT" in
  TaskCompleted) EVENT_TYPE="task_completed" ;;
  TeammateIdle)  EVENT_TYPE="teammate_idle" ;;
  *) exit 0 ;;
esac

TIMESTAMP=$(utc_timestamp)

ENTRY=$(jq -cn \
  --arg ts "$TIMESTAMP" \
  --arg ev "$EVENT_TYPE" \
  --arg sid "$SESSION_ID" \
  --arg project "$PROJECT" \
  '{timestamp: $ts, event: $ev, session_id: $sid, project: $project}')

# Append any extra fields from the hook input
EXTRA=$(jq -c 'del(.hook_event_name, .session_id, .cwd, .transcript_path)' < "$_HOOK_INPUT_FILE" 2>/dev/null)
if [ -n "$EXTRA" ] && [ "$EXTRA" != "{}" ]; then
  ENTRY=$(echo "$ENTRY" | jq -c --argjson extra "$EXTRA" '. + {details: $extra}')
fi

emit_event "tasks" "$ENTRY" "$(jq -cn \
  --arg source "claude-code" \
  --arg event "$EVENT_TYPE" \
  --arg project "$PROJECT" \
  '{source: $source, event: $event, project: $project}')"

exit 0
