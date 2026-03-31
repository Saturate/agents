#!/bin/bash
#
# Tool failure logger for Claude Code hooks.
# Handles PostToolUseFailure events.
# Writes to ~/.claude/logs/tool-usage-YYYY-MM-DD.jsonl (same file as normal tool events).
#
# Never blocks — always exits 0.

source "$(dirname "$0")/lib.sh"

[ "$HOOK_EVENT" = "PostToolUseFailure" ] || exit 0

TOOL_NAME=$(hook_field tool_name)
TOOL_USE_ID=$(hook_field tool_use_id)
TIMESTAMP=$(utc_timestamp)

ERROR=$(jq -r '.tool_response // .error // empty' < "$_HOOK_INPUT_FILE" | head -c 500)
IS_INTERRUPT=$(jq -r '.is_interrupt // false' < "$_HOOK_INPUT_FILE")

# Duration from PreToolUse timing file
DURATION_MS="null"
if [ -f "$TIMING_DIR/$TOOL_USE_ID" ]; then
  START_NS=$(cat "$TIMING_DIR/$TOOL_USE_ID" 2>/dev/null || echo "")
  if [ -n "$START_NS" ]; then
    END_NS=$(nano_timestamp)
    if [ -n "$END_NS" ]; then
      DURATION_MS=$(( (END_NS - START_NS) / 1000000 ))
    fi
  fi
  rm -f "$TIMING_DIR/$TOOL_USE_ID"
fi

ENTRY=$(jq -cn \
  --arg ts "$TIMESTAMP" \
  --arg ev "tool_failure" \
  --arg sid "$SESSION_ID" \
  --arg tuid "$TOOL_USE_ID" \
  --arg tool "$TOOL_NAME" \
  --arg cwd "$CWD" \
  --arg project "$PROJECT" \
  --arg git_branch "$GIT_BRANCH" \
  --arg error "$ERROR" \
  --argjson is_interrupt "$IS_INTERRUPT" \
  --argjson duration_ms "$DURATION_MS" \
  '{timestamp: $ts, event: $ev, session_id: $sid, tool_use_id: $tuid, tool_name: $tool, cwd: $cwd, project: $project, git_branch: $git_branch, error: $error, is_interrupt: $is_interrupt, duration_ms: $duration_ms}')

log_entry "tool-usage" "$ENTRY"

# Increment per-turn failure counter (read by log-turn.sh on Stop)
TURN_FAILURES_FILE="$TIMING_DIR/turn-failures-$SESSION_ID"
CURRENT=$(cat "$TURN_FAILURES_FILE" 2>/dev/null || echo 0)
echo $((CURRENT + 1)) > "$TURN_FAILURES_FILE"

push_loki "$(jq -cn \
  --arg source "claude-code" \
  --arg event "tool_failure" \
  --arg tool_name "$TOOL_NAME" \
  --arg project "$PROJECT" \
  '{source: $source, event: $event, tool_name: $tool_name, project: $project}')" "$ENTRY"

exit 0
