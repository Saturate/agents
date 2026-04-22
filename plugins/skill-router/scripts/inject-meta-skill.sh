#!/bin/bash
#
# SessionStart hook: inject the skill-router meta-skill into the session context
# so the model has the skill-routing map in front of it from turn 1.
#
# Looks for skill-router/SKILL.md in these locations, first hit wins:
#   1. $HOME/.claude/skills/skill-router/SKILL.md     (user-installed via install.sh)
#   2. $CLAUDE_PLUGIN_ROOT/../../skills/skill-router/SKILL.md  (mono-repo install)
#
# Emits JSON per Claude Code hooks spec with additionalContext. Fails silent:
# if the skill is missing, the session just starts without the map.

set -uo pipefail

META_SKILL=""
for candidate in \
  "$HOME/.claude/skills/skill-router/SKILL.md" \
  "${CLAUDE_PLUGIN_ROOT:-}/../../skills/skill-router/SKILL.md"
do
  if [ -f "$candidate" ]; then
    META_SKILL="$candidate"
    break
  fi
done

if [ -z "$META_SKILL" ]; then
  # Silent no-op — don't break the session
  exit 0
fi

CONTENT=$(cat "$META_SKILL")

# JSON-encode content (newlines, quotes) via jq
jq -cn \
  --arg ctx "$CONTENT" \
  '{
    hookSpecificOutput: {
      hookEventName: "SessionStart",
      additionalContext: $ctx
    }
  }'

exit 0
