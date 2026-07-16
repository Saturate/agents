#!/bin/bash
#
# SessionStart hook: inject the skill-router meta-skill into the session context
# so the model has the skill-routing map in front of it from turn 1.
#
# Also generates a per-session SKILL_ACK nonce (see below).
#
# Looks for skill-router/SKILL.md in these locations, first hit wins:
#   1. $HOME/.claude/skills/skill-router/SKILL.md     (user-installed via install.sh)
#   2. $CLAUDE_PLUGIN_ROOT/../../skills/skill-router/SKILL.md  (mono-repo install)
#
# Emits JSON per Claude Code hooks spec with additionalContext. Fails silent:
# if the skill is missing, the session just starts without the map.

set -uo pipefail

# ── SKILL_ACK nonce ──────────────────────────────────────────────────
#
# The advisor blocks commands like `gh pr create` and requires the model
# to invoke the corresponding skill first. The skill then re-runs the
# command with a SKILL_ACK prefix to pass through.
#
# Problem: the model can guess SKILL_ACK=<skill-name> and skip the skill
# entirely. We've observed this happening in practice.
#
# Fix: a random 12-char nonce generated here at session start. Skills
# read it at runtime via $(cat ~/.claude/.skill-nonce) and construct
# SKILL_ACK=<nonce>:<skill-name>. The advisor (skill-advisor.sh) only
# accepts the nonce-prefixed form; bare SKILL_ACK=<name> is rejected.
#
# Cache-safe: the nonce value never enters the prompt context. Skills
# reference it by file path (a static string), and the shell expands it
# only when the bash command executes. Prompt caching is unaffected.
NONCE_FILE="$HOME/.claude/.skill-nonce"
NONCE=$(LC_ALL=C tr -dc 'a-z0-9' < /dev/urandom | head -c 12 || true)
if [ -n "$NONCE" ]; then
  printf '%s' "$NONCE" > "$NONCE_FILE"
fi

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
