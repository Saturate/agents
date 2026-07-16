#!/bin/bash
#
# PreToolUse Bash hook: just-in-time skill advisor.
#
# Three rule types in advisor-rules.conf:
#   block — Blocks the tool call with a nudge to invoke the named skill.
#           The skill unlocks the command via SKILL_ACK=<nonce>:<skill>.
#   gate  — Blocks the tool call with a custom reason (no skill needed).
#           Show the user what you're about to do, get approval, then
#           re-run with SKILL_ACK=<nonce>:<gate-name> prefix.
#   flow  — Adds advisory context about a skill for the next step.
#           Non-blocking, emits additionalContext.
#
# The SKILL_ACK=<nonce>:<name> prefix is the only unlock mechanism.
# The nonce is generated per session by inject-meta-skill.sh and stored
# at ~/.claude/.skill-nonce. A bare SKILL_ACK=<name> (no nonce) is
# treated as the model guessing the prefix and is rejected; the
# SKILL_ACK= prefix is stripped and the underlying command gets matched
# against rules as if it were never there.

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

# Validate SKILL_ACK nonce: only strip acknowledged segments whose nonce
# matches the current session nonce. A bare SKILL_ACK=<skill-name> without
# a valid nonce is treated as unacknowledged (the model guessed it).
NONCE_FILE="$HOME/.claude/.skill-nonce"
SESSION_NONCE=""
[ -f "$NONCE_FILE" ] && SESSION_NONCE=$(cat "$NONCE_FILE" 2>/dev/null)

if [ -n "$SESSION_NONCE" ]; then
  # Strip properly acknowledged lines (correct nonce)
  NORM_CMD=$(printf '%s\n' "$NORM_CMD" | grep -v "^[[:space:]]*SKILL_ACK=${SESSION_NONCE}:" || true)
  # Lines with invalid/missing nonce: strip the SKILL_ACK= prefix so the
  # underlying command still gets matched against advisor rules.
  NORM_CMD=$(printf '%s\n' "$NORM_CMD" | sed -E 's/^([[:space:]]*)SKILL_ACK=[^ ]+ /\1/')
else
  # Fallback: no nonce file, accept old-style SKILL_ACK=<name>
  NORM_CMD=$(printf '%s\n' "$NORM_CMD" | grep -v '^[[:space:]]*SKILL_ACK=' || true)
fi
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
