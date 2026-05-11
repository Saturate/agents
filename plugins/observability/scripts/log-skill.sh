#!/bin/bash
#
# Skill invocation logger for Claude Code hooks.
# Matched on PreToolUse with matcher "Skill".
# Writes to ~/.claude/logs/skills-YYYY-MM-DD.jsonl
#
# Never blocks — always exits 0.

source "$(dirname "$0")/lib.sh"

TIMESTAMP=$(utc_timestamp)
SKILL_NAME=$(jq -r '.tool_input.skill // .tool_input.name // empty' < "$_HOOK_INPUT_FILE")
SKILL_ARGS=$(jq -r '.tool_input.args // empty' < "$_HOOK_INPUT_FILE")

ENTRY=$(jq -cn \
  --arg ts "$TIMESTAMP" \
  --arg ev "skill_invoked" \
  --arg sid "$SESSION_ID" \
  --arg project "$PROJECT" \
  --arg skill "$SKILL_NAME" \
  --arg args "$SKILL_ARGS" \
  '{timestamp: $ts, event: $ev, session_id: $sid, project: $project, skill: $skill, args: $args}')

emit_event "skills" "$ENTRY" "$(jq -cn \
  --arg source "claude-code" \
  --arg event "skill_invoked" \
  --arg skill "$SKILL_NAME" \
  --arg project "$PROJECT" \
  '{source: $source, event: $event, skill: $skill, project: $project}')"

exit 0
