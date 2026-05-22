#!/bin/bash
#
# PreToolUse Bash hook: just-in-time skill advisor.
#
# Two rule types in advisor-rules.conf:
#   block — Blocks the tool call with a nudge to invoke the skill.
#           The skill unlocks the command via SKILL_ACK=<skill> prefix.
#   flow  — Adds advisory context about a skill for the next step.
#           Non-blocking, emits additionalContext.
#
# No file markers or external state. The SKILL_ACK=<skill> prefix in
# the command itself is the only unlock mechanism — controlled by the
# skill, not the hook.

set -uo pipefail

command -v jq >/dev/null 2>&1 || exit 0

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
RULES_FILE="$SCRIPT_DIR/advisor-rules.conf"
[ -f "$RULES_FILE" ] || exit 0

if [ -t 0 ]; then
  exit 0
fi
INPUT=$(cat)

TOOL_NAME=$(printf '%s' "$INPUT" | jq -r '.tool_name // empty' 2>/dev/null)
[ "$TOOL_NAME" = "Bash" ] || exit 0

CMD=$(printf '%s' "$INPUT" | jq -r '.tool_input.command // empty' 2>/dev/null)
[ -z "$CMD" ] && exit 0

# Skill acknowledged — the model consulted the skill and is proceeding
case "$CMD" in
  SKILL_ACK=*) exit 0 ;;
esac

# Walk rules: block on first block match, collect flow advisories
FLOW_ADVICE=""

while IFS=$'\t' read -r action pattern skills message || [ -n "$action" ]; do
  case "$action" in ''|'#'*) continue ;; esac
  [ -z "${pattern:-}" ] && continue
  [ -z "${skills:-}" ] && continue

  if printf '%s' "$CMD" | grep -Eq "$pattern" 2>/dev/null; then
    if [ "$action" = "block" ]; then
      # Build "invoke /skill-a and /skill-b" from comma-separated list
      nudge=""
      count=0
      IFS=',' read -ra skill_arr <<< "$skills"
      for s in "${skill_arr[@]}"; do
        s="${s// /}"
        [ -z "$s" ] && continue
        count=$((count + 1))
        if [ -z "$nudge" ]; then
          nudge="\`/$s\`"
        else
          nudge="$nudge and \`/$s\`"
        fi
      done
      word="skill"; [ "$count" -gt 1 ] && word="skills"

      jq -cn --arg reason "Invoke the $nudge $word before proceeding. It will guide you through this safely." \
        '{ decision: "block", reason: $reason }'
      exit 0

    elif [ "$action" = "flow" ]; then
      [ -n "${message:-}" ] && FLOW_ADVICE="${FLOW_ADVICE:+$FLOW_ADVICE\n}$message"
    fi
  fi
done < "$RULES_FILE"

# Emit collected flow advisories as additionalContext
if [ -n "$FLOW_ADVICE" ]; then
  jq -cn --arg ctx "$FLOW_ADVICE" \
    '{ hookSpecificOutput: { additionalContext: $ctx } }'
fi

exit 0
