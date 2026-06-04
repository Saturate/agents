#!/bin/bash
#
# PreToolUse Bash hook: just-in-time skill advisor.
#
# Three rule types in advisor-rules.conf:
#   block — Blocks the tool call with a nudge to invoke the named skill.
#           The skill unlocks the command via SKILL_ACK=<skill> prefix.
#   gate  — Blocks the tool call with a custom reason (no skill needed).
#           Show the user what you're about to do, get approval, then
#           re-run with SKILL_ACK=<gate-name> prefix.
#   flow  — Adds advisory context about a skill for the next step.
#           Non-blocking, emits additionalContext.
#
# No file markers or external state. The SKILL_ACK=<name> prefix in
# the command itself is the only unlock mechanism — controlled by the
# skill (for block) or the model after user approval (for gate).

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

# Normalize compound commands: split on unquoted && and ; so each segment
# gets its own line.  The ^-anchored regexes in advisor-rules.conf then
# match each segment independently.  Note: splits inside quoted strings
# are possible but rare in Claude Code tool_input commands.
NORM_CMD=$(printf '%s' "$CMD" | sed -E 's/[[:space:]]*&&[[:space:]]*/\n/g; s/[[:space:]]*;[[:space:]]*/\n/g')

# Strip segments already acknowledged via SKILL_ACK= prefix.  Remaining
# unacknowledged segments still get matched against rules — bundling a
# gated command with a SKILL_ACK'd one won't sneak it through.
NORM_CMD=$(printf '%s\n' "$NORM_CMD" | grep -v '^[[:space:]]*SKILL_ACK=' || true)
[ -z "$NORM_CMD" ] && exit 0

# Walk rules: block on first block match, collect flow advisories
FLOW_ADVICE=""

while IFS=$'\t' read -r action pattern skills message || [ -n "$action" ]; do
  case "$action" in ''|'#'*) continue ;; esac
  [ -z "${pattern:-}" ] && continue
  [ -z "${skills:-}" ] && continue

  if printf '%s\n' "$NORM_CMD" | grep -Eq "$pattern" 2>/dev/null; then
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

    elif [ "$action" = "gate" ]; then
      # Custom gate: block with the message from the rules file.
      # The model must show the user what it's about to do, get approval,
      # then re-run with SKILL_ACK=<gate-name> prefix.
      gate_name="${skills// /}"
      reason="${message:-Show the user what you are about to do and get explicit approval before proceeding. Re-run with SKILL_ACK=$gate_name prefix after approval.}"
      jq -cn --arg reason "$reason" \
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
