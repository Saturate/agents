#!/bin/bash
#
# Notification logger for Claude Code hooks.
# Handles Notification events.
# Writes to ~/.claude/logs/notifications-YYYY-MM-DD.jsonl
#
# Never blocks — always exits 0.

source "$(dirname "$0")/lib.sh"

[ "$HOOK_EVENT" = "Notification" ] || exit 0

TIMESTAMP=$(utc_timestamp)
NOTIFICATION_TYPE=$(hook_field notification_type)
MESSAGE=$(hook_field message)
TITLE=$(hook_field title)

ENTRY=$(jq -cn \
  --arg ts "$TIMESTAMP" \
  --arg ev "notification" \
  --arg sid "$SESSION_ID" \
  --arg project "$PROJECT" \
  --arg notification_type "$NOTIFICATION_TYPE" \
  --arg title "$TITLE" \
  --arg message "$MESSAGE" \
  '{timestamp: $ts, event: $ev, session_id: $sid, project: $project, notification_type: $notification_type, title: $title, message: $message}')

log_entry "notifications" "$ENTRY"

push_loki "$(jq -cn \
  --arg source "claude-code" \
  --arg event "notification" \
  --arg notification_type "$NOTIFICATION_TYPE" \
  --arg project "$PROJECT" \
  '{source: $source, event: $event, notification_type: $notification_type, project: $project}')" "$ENTRY"

exit 0
