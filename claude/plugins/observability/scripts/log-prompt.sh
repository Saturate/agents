#!/bin/bash
#
# Prompt logger for Claude Code hooks.
# Handles UserPromptSubmit events.
# Writes to ~/.claude/logs/prompts-YYYY-MM-DD.jsonl
#
# Never blocks — always exits 0.

source "$(dirname "$0")/lib.sh"

[ "$HOOK_EVENT" = "UserPromptSubmit" ] || exit 0

TIMESTAMP=$(utc_timestamp)
PROMPT=$(jq -r '.prompt // empty' < "$_HOOK_INPUT_FILE")
LENGTH_CHARS=${#PROMPT}

ENTRY=$(jq -cn \
  --arg ts "$TIMESTAMP" \
  --arg ev "prompt" \
  --arg sid "$SESSION_ID" \
  --arg project "$PROJECT" \
  --arg prompt "$PROMPT" \
  --argjson length_chars "$LENGTH_CHARS" \
  '{timestamp: $ts, event: $ev, session_id: $sid, project: $project, prompt: $prompt, length_chars: $length_chars}')

log_entry "prompts" "$ENTRY"

push_loki "$(jq -cn \
  --arg source "claude-code" \
  --arg event "prompt" \
  --arg project "$PROJECT" \
  '{source: $source, event: $event, project: $project}')" "$ENTRY"

exit 0
