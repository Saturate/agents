#!/bin/bash
#
# Tool usage logger for Claude Code hooks.
# Handles both PreToolUse and PostToolUse events.
# Writes daily-rotated JSONL to ~/.claude/logs/tool-usage-YYYY-MM-DD.jsonl
#
# Never blocks — always exits 0.

set -euo pipefail

LOG_DIR="$HOME/.claude/logs"
LOG_FILE="$LOG_DIR/tool-usage-$(date +%Y-%m-%d).jsonl"
mkdir -p "$LOG_DIR"

INPUT=$(cat)

EVENT_NAME=$(echo "$INPUT" | jq -r '.hook_event_name // empty')
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // empty')
TOOL_USE_ID=$(echo "$INPUT" | jq -r '.tool_use_id // empty')
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // empty')
CWD=$(echo "$INPUT" | jq -r '.cwd // empty')

# Map hook event to short label
case "$EVENT_NAME" in
  PreToolUse)  EVENT="pre" ;;
  PostToolUse) EVENT="post" ;;
  *)           exit 0 ;; # ignore unknown events
esac

# Build a condensed summary of the tool input so we can search logs
# without storing full file contents or command output
summarize_input() {
  local tool="$1"
  local input
  input=$(echo "$INPUT" | jq -c '.tool_input // {}')

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
TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)

# Base entry fields shared by pre and post
ENTRY=$(jq -cn \
  --arg ts "$TIMESTAMP" \
  --arg ev "$EVENT" \
  --arg sid "$SESSION_ID" \
  --arg tuid "$TOOL_USE_ID" \
  --arg tool "$TOOL_NAME" \
  --arg cwd "$CWD" \
  --arg summary "$SUMMARY" \
  '{timestamp: $ts, event: $ev, session_id: $sid, tool_use_id: $tuid, tool_name: $tool, cwd: $cwd, input_summary: $summary}')

# Post-only fields
if [ "$EVENT" = "post" ]; then
  # Bash exit code lives in tool_response
  EXIT_CODE=$(echo "$INPUT" | jq '.tool_response.exit_code // null')

  # Byte length of the full response (avoids logging actual content)
  OUTPUT_SIZE=$(echo "$INPUT" | jq -r '.tool_response // empty' | wc -c | tr -d ' ')

  ENTRY=$(echo "$ENTRY" | jq -c \
    --argjson exit_code "$EXIT_CODE" \
    --argjson output_size "$OUTPUT_SIZE" \
    '. + {exit_code: $exit_code, output_size: $output_size}')
fi

echo "$ENTRY" >> "$LOG_FILE"

exit 0
