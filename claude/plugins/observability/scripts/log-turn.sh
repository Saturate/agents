#!/bin/bash
#
# Per-turn logger for Claude Code hooks.
# Handles Stop events (fires every turn).
# Writes to ~/.claude/logs/turns-YYYY-MM-DD.jsonl
#
# Must be fast (<100ms). Uses tail-based transcript parsing.
#
# Never blocks — always exits 0.

source "$(dirname "$0")/lib.sh"

[ "$HOOK_EVENT" = "Stop" ] || exit 0

TIMESTAMP=$(utc_timestamp)
STOP_HOOK_ACTIVE=$(hook_field stop_hook_active)

# Increment turn counter
TURN_COUNT_FILE="$TIMING_DIR/turn-count-$SESSION_ID"
TURN_NUMBER=$(cat "$TURN_COUNT_FILE" 2>/dev/null || echo 0)
TURN_NUMBER=$((TURN_NUMBER + 1))
echo "$TURN_NUMBER" > "$TURN_COUNT_FILE"

# Read model from session file, fall back to transcript
SESSION_FILE="$TIMING_DIR/session-$SESSION_ID"
MODEL=""
[ -f "$SESSION_FILE" ] && MODEL=$(head -1 "$SESSION_FILE" 2>/dev/null || echo "")

# If model is empty or looks like a timestamp, try extracting from transcript
if [ -z "$MODEL" ] || [[ "$MODEL" =~ ^[0-9]+$ ]]; then
  MODEL=""
  if [ -n "$TRANSCRIPT_PATH" ] && [ -f "$TRANSCRIPT_PATH" ]; then
    MODEL=$(head -20 "$TRANSCRIPT_PATH" 2>/dev/null | jq -r 'select(.type == "assistant") | .message.model // empty' 2>/dev/null | head -1)
    # Backfill the session file so future turns don't need to parse again
    if [ -n "$MODEL" ] && [ -f "$SESSION_FILE" ]; then
      TIMESTAMP_LINE=$(tail -1 "$SESSION_FILE" 2>/dev/null)
      echo "$MODEL" > "$SESSION_FILE"
      echo "$TIMESTAMP_LINE" >> "$SESSION_FILE"
    fi
  fi
fi

# Token usage for this turn (tail-based, ~4ms)
USAGE='{}'
COST="0"
if [ -n "$TRANSCRIPT_PATH" ] && [ -f "$TRANSCRIPT_PATH" ]; then
  USAGE=$(parse_last_turn_usage "$TRANSCRIPT_PATH")
  if [ "$USAGE" != "{}" ] && [ -n "$USAGE" ]; then
    INPUT_T=$(echo "$USAGE" | jq -r '.input_tokens // 0')
    OUTPUT_T=$(echo "$USAGE" | jq -r '.output_tokens // 0')
    CACHE_READ=$(echo "$USAGE" | jq -r '.cache_read_input_tokens // 0')
    CACHE_CREATE=$(echo "$USAGE" | jq -r '.cache_creation_input_tokens // 0')
    [ -n "$MODEL" ] && COST=$(calculate_cost "$MODEL" "$INPUT_T" "$OUTPUT_T" "$CACHE_READ" "$CACHE_CREATE")
  fi
fi

# Read and reset tool counters (set by log-tool-usage.sh and log-tool-failure.sh)
TURN_TOOLS_FILE="$TIMING_DIR/turn-tools-$SESSION_ID"
TOOL_COUNT=$(cat "$TURN_TOOLS_FILE" 2>/dev/null || echo 0)
echo 0 > "$TURN_TOOLS_FILE"

TURN_FAILURES_FILE="$TIMING_DIR/turn-failures-$SESSION_ID"
TOOL_FAILURES=$(cat "$TURN_FAILURES_FILE" 2>/dev/null || echo 0)
echo 0 > "$TURN_FAILURES_FILE"

ENTRY=$(jq -cn \
  --arg ts "$TIMESTAMP" \
  --arg ev "turn" \
  --arg sid "$SESSION_ID" \
  --arg project "$PROJECT" \
  --arg git_branch "$GIT_BRANCH" \
  --arg model "$MODEL" \
  --argjson turn_number "$TURN_NUMBER" \
  --argjson usage "$USAGE" \
  --argjson cost "$COST" \
  --argjson tool_count "$TOOL_COUNT" \
  --argjson tool_failures "$TOOL_FAILURES" \
  --arg stop_hook_active "$STOP_HOOK_ACTIVE" \
  '{timestamp: $ts, event: $ev, session_id: $sid, project: $project, git_branch: $git_branch, model: $model, turn_number: $turn_number, usage: $usage, estimated_cost_usd: $cost, tool_count: $tool_count, tool_failures: $tool_failures, stop_hook_active: $stop_hook_active}')

log_entry "turns" "$ENTRY"

push_loki "$(jq -cn \
  --arg source "claude-code" \
  --arg event "turn" \
  --arg project "$PROJECT" \
  --arg model "$MODEL" \
  '{source: $source, event: $event, project: $project, model: $model}')" "$ENTRY"

exit 0
