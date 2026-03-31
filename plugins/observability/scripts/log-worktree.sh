#!/bin/bash
#
# Worktree logger for Claude Code hooks.
# Handles WorktreeCreate and WorktreeRemove events.
# Writes to ~/.claude/logs/worktrees-YYYY-MM-DD.jsonl
#
# Never blocks — always exits 0.

source "$(dirname "$0")/lib.sh"

case "$HOOK_EVENT" in
  WorktreeCreate) EVENT_TYPE="worktree_create" ;;
  WorktreeRemove) EVENT_TYPE="worktree_remove" ;;
  *) exit 0 ;;
esac

TIMESTAMP=$(utc_timestamp)
WORKTREE_PATH=$(hook_field worktree_path)
BRANCH=$(hook_field branch)

ENTRY=$(jq -cn \
  --arg ts "$TIMESTAMP" \
  --arg ev "$EVENT_TYPE" \
  --arg sid "$SESSION_ID" \
  --arg project "$PROJECT" \
  --arg worktree_path "$WORKTREE_PATH" \
  --arg branch "$BRANCH" \
  '{timestamp: $ts, event: $ev, session_id: $sid, project: $project, worktree_path: $worktree_path, branch: $branch}')

log_entry "worktrees" "$ENTRY"

push_loki "$(jq -cn \
  --arg source "claude-code" \
  --arg event "$EVENT_TYPE" \
  --arg project "$PROJECT" \
  '{source: $source, event: $event, project: $project}')" "$ENTRY"

exit 0
