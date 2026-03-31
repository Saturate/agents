#!/bin/bash
#
# Config change logger for Claude Code hooks.
# Handles ConfigChange events.
# Writes to ~/.claude/logs/config-changes-YYYY-MM-DD.jsonl
#
# Never blocks — always exits 0.

source "$(dirname "$0")/lib.sh"

[ "$HOOK_EVENT" = "ConfigChange" ] || exit 0

TIMESTAMP=$(utc_timestamp)
CONFIG_SOURCE=$(hook_field config_source)

ENTRY=$(jq -cn \
  --arg ts "$TIMESTAMP" \
  --arg ev "config_change" \
  --arg sid "$SESSION_ID" \
  --arg project "$PROJECT" \
  --arg config_source "$CONFIG_SOURCE" \
  '{timestamp: $ts, event: $ev, session_id: $sid, project: $project, config_source: $config_source}')

log_entry "config-changes" "$ENTRY"

push_loki "$(jq -cn \
  --arg source "claude-code" \
  --arg event "config_change" \
  --arg project "$PROJECT" \
  '{source: $source, event: $event, project: $project}')" "$ENTRY"

exit 0
