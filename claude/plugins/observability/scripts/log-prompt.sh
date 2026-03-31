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

# Tag skill invocations from prompt text
SKILL_NAME=""
if [[ "$PROMPT" =~ ^/([a-zA-Z0-9_:./-]+) ]]; then
  SKILL_NAME="${BASH_REMATCH[1]}"
fi

ENTRY=$(jq -cn \
  --arg ts "$TIMESTAMP" \
  --arg ev "prompt" \
  --arg sid "$SESSION_ID" \
  --arg project "$PROJECT" \
  --arg prompt "$PROMPT" \
  --argjson length_chars "$LENGTH_CHARS" \
  --arg skill "$SKILL_NAME" \
  '{timestamp: $ts, event: $ev, session_id: $sid, project: $project, prompt: $prompt, length_chars: $length_chars} + (if $skill != "" then {skill: $skill} else {} end)')

log_entry "prompts" "$ENTRY"

push_loki "$(jq -cn \
  --arg source "claude-code" \
  --arg event "prompt" \
  --arg project "$PROJECT" \
  '{source: $source, event: $event, project: $project}')" "$ENTRY"

exit 0
