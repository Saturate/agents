#!/bin/bash
#
# PreToolUse Bash hook: just-in-time skill advisor.
#
# Reads rules from advisor-rules.conf (regex → skill). When the pending
# bash command matches a rule, emits that skill's SKILL.md as additional
# context so the model considers it before running the command.
#
# Dedupes per session: each skill is advised at most once per session,
# tracked via marker files under /tmp/claude-skill-advisor-<session>/.
# Without dedupe, running `npm install a && npm install b` would spam
# the skill body twice.
#
# Fails silent: if a SKILL.md is missing, skip. If no rule matches,
# exit with no output. Never blocks the tool call.

set -uo pipefail

# Graceful degradation if jq is missing
command -v jq >/dev/null 2>&1 || exit 0

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
RULES_FILE="$SCRIPT_DIR/advisor-rules.conf"
[ -f "$RULES_FILE" ] || exit 0

# Parse hook input
if [ -t 0 ]; then
  exit 0
fi
INPUT=$(cat)

TOOL_NAME=$(printf '%s' "$INPUT" | jq -r '.tool_name // empty' 2>/dev/null)
[ "$TOOL_NAME" = "Bash" ] || exit 0

CMD=$(printf '%s' "$INPUT" | jq -r '.tool_input.command // empty' 2>/dev/null)
[ -z "$CMD" ] && exit 0

SESSION_ID=$(printf '%s' "$INPUT" | jq -r '.session_id // empty' 2>/dev/null)
[ -z "$SESSION_ID" ] && SESSION_ID="unknown"

DEDUPE_DIR="/tmp/claude-skill-advisor-$SESSION_ID"
mkdir -p "$DEDUPE_DIR"

# Skill lookup locations, first hit wins
skill_path() {
  local name="$1"
  for candidate in \
    "$HOME/.claude/skills/$name/SKILL.md" \
    "$SCRIPT_DIR/../../../skills/$name/SKILL.md"
  do
    if [ -f "$candidate" ]; then
      echo "$candidate"
      return 0
    fi
  done
  return 1
}

# Walk rules, collect matching skills (deduped within this invocation + session).
# Bash 3.2 compat: use a space-delimited string for "seen" tracking, not an assoc array.
MATCHED_SKILLS=""
SEEN=" "

while IFS=$'\t' read -r pattern skills || [ -n "$pattern" ]; do
  # Skip comments and blank lines
  case "$pattern" in ''|'#'*) continue ;; esac
  [ -z "${skills:-}" ] && continue

  # Match the regex against the command (extended regex, quiet)
  if printf '%s' "$CMD" | grep -Eq "$pattern" 2>/dev/null; then
    IFS=',' read -ra skill_list <<< "$skills"
    for skill in "${skill_list[@]}"; do
      skill="${skill// /}"   # trim spaces
      [ -z "$skill" ] && continue

      # Within-invocation dedupe
      case "$SEEN" in *" $skill "*) continue ;; esac

      # Per-session dedupe: advise each skill at most once per session
      [ -f "$DEDUPE_DIR/$skill" ] && continue

      SEEN="$SEEN$skill "
      MATCHED_SKILLS="$MATCHED_SKILLS $skill"
    done
  fi
done < "$RULES_FILE"

[ -z "${MATCHED_SKILLS// /}" ] && exit 0

# Build the advisory content
ADVISORY=""
for skill in $MATCHED_SKILLS; do
  path=$(skill_path "$skill") || continue
  body=$(cat "$path")
  ADVISORY="$ADVISORY

---

# skill-router: before running this command, consult \`$skill\`

$body
"
  touch "$DEDUPE_DIR/$skill"
done

[ -z "$ADVISORY" ] && exit 0

# Emit as PreToolUse additionalContext (documented hook JSON format)
jq -cn \
  --arg ctx "$ADVISORY" \
  '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      additionalContext: $ctx
    }
  }'

exit 0
