#!/bin/bash
#
# Session logger for Claude Code hooks.
# Handles SessionStart and SessionEnd events.
# Writes to ~/.claude/logs/sessions-YYYY-MM-DD.jsonl
#
# SessionEnd includes full session summary: total tokens, cost, duration,
# turn count, tool count, compaction count.
#
# Never blocks — always exits 0.

source "$(dirname "$0")/lib.sh"

TIMESTAMP=$(utc_timestamp)

case "$HOOK_EVENT" in
  SessionStart)
    MODEL=$(hook_field model)
    AGENT_TYPE=$(hook_field agent_type)

    # Store start time + model for SessionEnd duration calc
    SESSION_FILE="$TIMING_DIR/session-$SESSION_ID"
    echo "$MODEL" > "$SESSION_FILE"
    nano_timestamp >> "$SESSION_FILE"

    ENTRY=$(jq -cn \
      --arg ts "$TIMESTAMP" \
      --arg ev "session_start" \
      --arg sid "$SESSION_ID" \
      --arg cwd "$CWD" \
      --arg project "$PROJECT" \
      --arg git_branch "$GIT_BRANCH" \
      --arg model "$MODEL" \
      --arg agent_type "$AGENT_TYPE" \
      '{timestamp: $ts, event: $ev, session_id: $sid, cwd: $cwd, project: $project, git_branch: $git_branch, model: $model, agent_type: $agent_type}')

    log_entry "sessions" "$ENTRY"

    push_loki "$(jq -cn \
      --arg source "claude-code" \
      --arg event "session" \
      --arg project "$PROJECT" \
      '{source: $source, event: $event, project: $project}')" "$ENTRY"
    ;;

  SessionEnd)
    REASON=$(hook_field reason)

    # Read stored session model + start time
    SESSION_FILE="$TIMING_DIR/session-$SESSION_ID"
    MODEL=""
    DURATION_S="null"
    if [ -f "$SESSION_FILE" ]; then
      MODEL=$(head -1 "$SESSION_FILE" 2>/dev/null || echo "")
      START_NS=$(tail -1 "$SESSION_FILE" 2>/dev/null || echo "")
      if [ -n "$START_NS" ]; then
        END_NS=$(nano_timestamp)
        DURATION_S=$(( (END_NS - START_NS) / 1000000000 ))
      fi
      rm -f "$SESSION_FILE"
    fi

    # Parse transcript for token totals
    USAGE='{}'
    COST="0"
    CACHE_HIT_RATE="0"
    TURN_COUNT=0
    if [ -n "$TRANSCRIPT_PATH" ] && [ -f "$TRANSCRIPT_PATH" ]; then
      USAGE=$(parse_transcript_totals "$TRANSCRIPT_PATH")
      INPUT_T=$(echo "$USAGE" | jq -r '.input_tokens // 0')
      OUTPUT_T=$(echo "$USAGE" | jq -r '.output_tokens // 0')
      CACHE_READ=$(echo "$USAGE" | jq -r '.cache_read_input_tokens // 0')
      CACHE_CREATE=$(echo "$USAGE" | jq -r '.cache_creation_input_tokens // 0')
      TURN_COUNT=$(echo "$USAGE" | jq -r '.turn_count // 0')

      [ -n "$MODEL" ] && COST=$(calculate_cost "$MODEL" "$INPUT_T" "$OUTPUT_T" "$CACHE_READ" "$CACHE_CREATE")

      # cache_hit_rate = cache_read / (cache_read + cache_create + input)
      TOTAL_INPUT=$((CACHE_READ + CACHE_CREATE + INPUT_T))
      if [ "$TOTAL_INPUT" -gt 0 ] 2>/dev/null; then
        CACHE_HIT_RATE=$(awk -v cr="$CACHE_READ" -v total="$TOTAL_INPUT" 'BEGIN { printf "%.4f\n", cr / total }')
      fi
    fi

    # Count tools from today's tool-usage log for this session
    TODAY=$(date +%Y-%m-%d)
    TOOL_COUNT=0
    TOOL_LOG="$LOG_DIR/tool-usage-$TODAY.jsonl"
    if [ -f "$TOOL_LOG" ]; then
      TOOL_COUNT=$(grep -c "\"session_id\":\"$SESSION_ID\"" "$TOOL_LOG" 2>/dev/null || echo 0)
    fi

    # Count compactions from today's log
    COMPACTION_COUNT=0
    COMPACT_LOG="$LOG_DIR/compactions-$TODAY.jsonl"
    if [ -f "$COMPACT_LOG" ]; then
      COMPACTION_COUNT=$(grep -c "\"session_id\":\"$SESSION_ID\"" "$COMPACT_LOG" 2>/dev/null || echo 0)
    fi

    ENTRY=$(jq -cn \
      --arg ts "$TIMESTAMP" \
      --arg ev "session_end" \
      --arg sid "$SESSION_ID" \
      --arg cwd "$CWD" \
      --arg project "$PROJECT" \
      --arg git_branch "$GIT_BRANCH" \
      --arg model "$MODEL" \
      --arg reason "$REASON" \
      --argjson duration_s "$DURATION_S" \
      --argjson usage "$USAGE" \
      --argjson cost "$COST" \
      --argjson cache_hit_rate "$CACHE_HIT_RATE" \
      --argjson turn_count "$TURN_COUNT" \
      --argjson tool_count "$TOOL_COUNT" \
      --argjson compaction_count "$COMPACTION_COUNT" \
      '{timestamp: $ts, event: $ev, session_id: $sid, cwd: $cwd, project: $project, git_branch: $git_branch, model: $model, reason: $reason, duration_s: $duration_s, usage: $usage, estimated_cost_usd: $cost, cache_hit_rate: $cache_hit_rate, turn_count: $turn_count, tool_count: $tool_count, compaction_count: $compaction_count}')

    log_entry "sessions" "$ENTRY"

    push_loki "$(jq -cn \
      --arg source "claude-code" \
      --arg event "session" \
      --arg project "$PROJECT" \
      '{source: $source, event: $event, project: $project}')" "$ENTRY"

    # Clean up turn counter files
    rm -f "$TIMING_DIR/turn-count-$SESSION_ID" "$TIMING_DIR/turn-tools-$SESSION_ID" "$TIMING_DIR/turn-failures-$SESSION_ID"
    ;;

  *) exit 0 ;;
esac

exit 0
