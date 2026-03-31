#!/bin/bash
#
# Tool usage logger for Claude Code hooks.
# Handles both PreToolUse and PostToolUse events.
# Writes daily-rotated JSONL to ~/.claude/logs/tool-usage-YYYY-MM-DD.jsonl
# Pushes each event to Loki (backgrounded, never blocks).
#
# Never blocks — always exits 0.

source "$(dirname "$0")/lib.sh"

TOOL_NAME=$(hook_field tool_name)
TOOL_USE_ID=$(hook_field tool_use_id)

# Map hook event to short label
case "$HOOK_EVENT" in
  PreToolUse)  EVENT="pre" ;;
  PostToolUse) EVENT="post" ;;
  *)           exit 0 ;;
esac

# Build a condensed summary of the tool input so we can search logs
# without storing full file contents or command output
summarize_input() {
  local tool="$1"
  local input
  input=$(jq -c '.tool_input // {}' < "$_HOOK_INPUT_FILE")

  case "$tool" in
    Bash)
      echo "$input" | jq -r '.command // empty'
      ;;
    Read)
      echo "$input" | jq -r '.file_path // empty'
      ;;
    Edit|Write)
      echo "$input" | jq -r '.file_path // empty'
      ;;
    Grep)
      echo "$input" | jq -r '.pattern // empty'
      ;;
    Glob)
      echo "$input" | jq -r '.pattern // empty'
      ;;
    WebFetch)
      echo "$input" | jq -r '.url // empty'
      ;;
    WebSearch)
      echo "$input" | jq -r '.query // empty'
      ;;
    Task)
      echo "$input" | jq -r '.description // empty'
      ;;
    *)
      # For MCP tools and others, grab first string value as a hint
      echo "$input" | jq -r 'to_entries | map(select(.value | type == "string")) | .[0].value // empty'
      ;;
  esac
}

SUMMARY=$(summarize_input "$TOOL_NAME")
TIMESTAMP=$(utc_timestamp)

# Duration tracking via nanosecond timestamps
if [ "$EVENT" = "pre" ]; then
  nano_timestamp > "$TIMING_DIR/$TOOL_USE_ID" 2>/dev/null || true
fi

DURATION_MS="null"
if [ "$EVENT" = "post" ] && [ -f "$TIMING_DIR/$TOOL_USE_ID" ]; then
  START_NS=$(cat "$TIMING_DIR/$TOOL_USE_ID" 2>/dev/null || echo "")
  if [ -n "$START_NS" ]; then
    END_NS=$(nano_timestamp)
    if [ -n "$END_NS" ]; then
      DURATION_MS=$(( (END_NS - START_NS) / 1000000 ))
    fi
  fi
  rm -f "$TIMING_DIR/$TOOL_USE_ID"
fi

# Base entry fields shared by pre and post
ENTRY=$(jq -cn \
  --arg ts "$TIMESTAMP" \
  --arg ev "$EVENT" \
  --arg sid "$SESSION_ID" \
  --arg tuid "$TOOL_USE_ID" \
  --arg tool "$TOOL_NAME" \
  --arg cwd "$CWD" \
  --arg transcript "$TRANSCRIPT_PATH" \
  --arg project "$PROJECT" \
  --arg git_remote "$GIT_REMOTE" \
  --arg git_branch "$GIT_BRANCH" \
  --arg summary "$SUMMARY" \
  '{timestamp: $ts, event: $ev, session_id: $sid, tool_use_id: $tuid, tool_name: $tool, cwd: $cwd, transcript_path: $transcript, project: $project, git_remote: $git_remote, git_branch: $git_branch, input_summary: $summary}')

# Post-only fields
if [ "$EVENT" = "post" ]; then
  # Bash exit code lives in tool_response
  EXIT_CODE=$(jq '.tool_response.exit_code // null' < "$_HOOK_INPUT_FILE")

  # Byte length of the full response (avoids logging actual content)
  OUTPUT_SIZE=$(jq -r '.tool_response // empty' < "$_HOOK_INPUT_FILE" | wc -c | tr -d ' ')

  ENTRY=$(echo "$ENTRY" | jq -c \
    --argjson exit_code "$EXIT_CODE" \
    --argjson output_size "$OUTPUT_SIZE" \
    --argjson duration_ms "$DURATION_MS" \
    '. + {exit_code: $exit_code, output_size: $output_size, duration_ms: $duration_ms}')

  # Increment per-turn tool counter (read by log-turn.sh on Stop)
  TURN_TOOLS_FILE="$TIMING_DIR/turn-tools-$SESSION_ID"
  CURRENT=$(cat "$TURN_TOOLS_FILE" 2>/dev/null || echo 0)
  echo $((CURRENT + 1)) > "$TURN_TOOLS_FILE"
fi

log_entry "tool-usage" "$ENTRY"

# Push to Loki
push_loki "$(jq -cn \
  --arg source "claude-code" \
  --arg event "tool" \
  --arg tool_name "$TOOL_NAME" \
  --arg project "$PROJECT" \
  '{source: $source, event: $event, tool_name: $tool_name, project: $project}')" "$ENTRY"

exit 0
