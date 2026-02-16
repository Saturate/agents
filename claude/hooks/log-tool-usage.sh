#!/bin/bash
#
# Tool usage logger for Claude Code hooks.
# Handles both PreToolUse and PostToolUse events.
# Writes daily-rotated JSONL to ~/.claude/logs/tool-usage-YYYY-MM-DD.jsonl
# Pushes each event to Loki (backgrounded, never blocks).
#
# Loki credentials: set LOKI_USER and LOKI_PASS in shell profile or local dotenv.
#
# Never blocks — always exits 0.

set -uo pipefail

LOG_DIR="$HOME/.claude/logs"
LOG_FILE="$LOG_DIR/tool-usage-$(date +%Y-%m-%d).jsonl"
TIMING_DIR="/tmp/claude-hook-timings"
mkdir -p "$LOG_DIR" "$TIMING_DIR"

LOKI_URL="https://loki.akj.io/loki/api/v1/push"

INPUT_FILE=$(mktemp)
trap 'rm -f "$INPUT_FILE"; exit 0' EXIT ERR
cat > "$INPUT_FILE"

EVENT_NAME=$(jq -r '.hook_event_name // empty' < "$INPUT_FILE")
TOOL_NAME=$(jq -r '.tool_name // empty' < "$INPUT_FILE")
TOOL_USE_ID=$(jq -r '.tool_use_id // empty' < "$INPUT_FILE")
SESSION_ID=$(jq -r '.session_id // empty' < "$INPUT_FILE")
CWD=$(jq -r '.cwd // empty' < "$INPUT_FILE")
TRANSCRIPT_PATH=$(jq -r '.transcript_path // empty' < "$INPUT_FILE")

# Map hook event to short label
case "$EVENT_NAME" in
  PreToolUse)  EVENT="pre" ;;
  PostToolUse) EVENT="post" ;;
  *)           exit 0 ;; # ignore unknown events
esac

# Git context from cwd: repo name from remote, branch
GIT_REMOTE=""
GIT_BRANCH=""
if [ -n "$CWD" ] && git -C "$CWD" rev-parse --git-dir >/dev/null 2>&1; then
  GIT_REMOTE=$(git -C "$CWD" remote get-url origin 2>/dev/null | sed 's|.*/||; s|\.git$||') || true
  GIT_BRANCH=$(git -C "$CWD" symbolic-ref --short HEAD 2>/dev/null || git -C "$CWD" rev-parse --short HEAD 2>/dev/null) || true
fi

# Project name: git remote > transcript path project slug > cwd basename
PROJECT=""
[ -n "$GIT_REMOTE" ] && PROJECT="$GIT_REMOTE"
if [ -z "$PROJECT" ] && [ -n "$TRANSCRIPT_PATH" ]; then
  # transcript_path looks like ~/.claude/projects/-Users-alkj-code-github-claude/session.jsonl
  # extract the project slug and grab the last segment
  PROJECT=$(echo "$TRANSCRIPT_PATH" | sed 's|.*/projects/||; s|/.*||; s|.*-||')
fi
[ -z "$PROJECT" ] && PROJECT="${CWD##*/}"

# Build a condensed summary of the tool input so we can search logs
# without storing full file contents or command output
summarize_input() {
  local tool="$1"
  local input
  input=$(jq -c '.tool_input // {}' < "$INPUT_FILE")

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

# Duration tracking via nanosecond timestamps
if [ "$EVENT" = "pre" ]; then
  # macOS: use perl for nanosecond-ish precision (date +%N not available)
  perl -MTime::HiRes=time -e 'printf "%.0f\n", time * 1e9' > "$TIMING_DIR/$TOOL_USE_ID" 2>/dev/null || true
fi

DURATION_MS="null"
if [ "$EVENT" = "post" ] && [ -f "$TIMING_DIR/$TOOL_USE_ID" ]; then
  START_NS=$(cat "$TIMING_DIR/$TOOL_USE_ID" 2>/dev/null || echo "")
  if [ -n "$START_NS" ]; then
    END_NS=$(perl -MTime::HiRes=time -e 'printf "%.0f\n", time * 1e9' 2>/dev/null || echo "")
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
  EXIT_CODE=$(jq '.tool_response.exit_code // null' < "$INPUT_FILE")

  # Byte length of the full response (avoids logging actual content)
  OUTPUT_SIZE=$(jq -r '.tool_response // empty' < "$INPUT_FILE" | wc -c | tr -d ' ')

  ENTRY=$(echo "$ENTRY" | jq -c \
    --argjson exit_code "$EXIT_CODE" \
    --argjson output_size "$OUTPUT_SIZE" \
    --argjson duration_ms "$DURATION_MS" \
    '. + {exit_code: $exit_code, output_size: $output_size, duration_ms: $duration_ms}')
fi

echo "$ENTRY" >> "$LOG_FILE"

# Push to Loki (backgrounded — never blocks the hook)
if [ -n "${LOKI_USER:-}" ] && [ -n "${LOKI_PASS:-}" ]; then
  LOKI_TS="$(date +%s)000000000"

  LOKI_PAYLOAD=$(jq -cn \
    --arg source "claude-code" \
    --arg event "$EVENT" \
    --arg tool_name "$TOOL_NAME" \
    --arg project "$PROJECT" \
    --arg git_branch "$GIT_BRANCH" \
    --arg ts "$LOKI_TS" \
    --arg line "$ENTRY" \
    '{streams: [{stream: {source: $source, event: $event, tool_name: $tool_name, project: $project, git_branch: $git_branch}, values: [[$ts, $line]]}]}')

  curl -s -u "$LOKI_USER:$LOKI_PASS" \
    "$LOKI_URL" \
    -H "Content-Type: application/json" \
    -d "$LOKI_PAYLOAD" \
    >/dev/null 2>&1 &
fi

exit 0
