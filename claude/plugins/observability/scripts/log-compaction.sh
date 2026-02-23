#!/bin/bash
#
# Compaction logger for Claude Code hooks.
# Handles PreCompact events.
# Writes to ~/.claude/logs/compactions-YYYY-MM-DD.jsonl
#
# Never blocks — always exits 0.

source "$(dirname "$0")/lib.sh"

[ "$HOOK_EVENT" = "PreCompact" ] || exit 0

TIMESTAMP=$(utc_timestamp)

ENTRY=$(jq -cn \
  --arg ts "$TIMESTAMP" \
  --arg ev "compaction" \
  --arg sid "$SESSION_ID" \
  --arg project "$PROJECT" \
  '{timestamp: $ts, event: $ev, session_id: $sid, project: $project}')

log_entry "compactions" "$ENTRY"

push_loki "$(jq -cn \
  --arg source "claude-code" \
  --arg event "compaction" \
  --arg project "$PROJECT" \
  '{source: $source, event: $event, project: $project}')" "$ENTRY"

exit 0
