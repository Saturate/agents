#!/bin/bash
#
# Subagent logger for Claude Code hooks.
# Handles SubagentStart and SubagentStop events.
# Writes to ~/.claude/logs/subagents-YYYY-MM-DD.jsonl
#
# Never blocks — always exits 0.

source "$(dirname "$0")/lib.sh"

TIMESTAMP=$(utc_timestamp)

case "$HOOK_EVENT" in
  SubagentStart)
    AGENT_ID=$(hook_field agent_id)
    AGENT_TYPE=$(hook_field agent_type)

    # Store start timestamp for duration calc
    nano_timestamp > "$TIMING_DIR/subagent-$AGENT_ID" 2>/dev/null || true

    ENTRY=$(jq -cn \
      --arg ts "$TIMESTAMP" \
      --arg ev "subagent_start" \
      --arg sid "$SESSION_ID" \
      --arg project "$PROJECT" \
      --arg agent_id "$AGENT_ID" \
      --arg agent_type "$AGENT_TYPE" \
      '{timestamp: $ts, event: $ev, session_id: $sid, project: $project, agent_id: $agent_id, agent_type: $agent_type}')

    log_entry "subagents" "$ENTRY"

    push_loki "$(jq -cn \
      --arg source "claude-code" \
      --arg event "subagent" \
      --arg project "$PROJECT" \
      '{source: $source, event: $event, project: $project}')" "$ENTRY"
    ;;

  SubagentStop)
    AGENT_ID=$(hook_field agent_id)
    AGENT_TYPE=$(hook_field agent_type)
    AGENT_TRANSCRIPT=$(hook_field agent_transcript_path)

    # Duration from stored start time
    DURATION_MS="null"
    if [ -f "$TIMING_DIR/subagent-$AGENT_ID" ]; then
      START_NS=$(cat "$TIMING_DIR/subagent-$AGENT_ID" 2>/dev/null || echo "")
      if [ -n "$START_NS" ]; then
        END_NS=$(nano_timestamp)
        if [ -n "$END_NS" ]; then
          DURATION_MS=$(( (END_NS - START_NS) / 1000000 ))
        fi
      fi
      rm -f "$TIMING_DIR/subagent-$AGENT_ID"
    fi

    # Parse subagent transcript for token usage
    USAGE='{}'
    COST="0"
    if [ -n "$AGENT_TRANSCRIPT" ] && [ -f "$AGENT_TRANSCRIPT" ]; then
      USAGE=$(parse_transcript_totals "$AGENT_TRANSCRIPT")
      if [ "$USAGE" != "{}" ] && [ -n "$USAGE" ]; then
        # Read model from session file
        SESSION_FILE="$TIMING_DIR/session-$SESSION_ID"
        MODEL=""
        [ -f "$SESSION_FILE" ] && MODEL=$(head -1 "$SESSION_FILE" 2>/dev/null || echo "")
        if [ -n "$MODEL" ]; then
          INPUT_T=$(echo "$USAGE" | jq -r '.input_tokens // 0')
          OUTPUT_T=$(echo "$USAGE" | jq -r '.output_tokens // 0')
          CACHE_READ=$(echo "$USAGE" | jq -r '.cache_read_input_tokens // 0')
          CACHE_CREATE=$(echo "$USAGE" | jq -r '.cache_creation_input_tokens // 0')
          COST=$(calculate_cost "$MODEL" "$INPUT_T" "$OUTPUT_T" "$CACHE_READ" "$CACHE_CREATE")
        fi
      fi
    fi

    ENTRY=$(jq -cn \
      --arg ts "$TIMESTAMP" \
      --arg ev "subagent_stop" \
      --arg sid "$SESSION_ID" \
      --arg project "$PROJECT" \
      --arg agent_id "$AGENT_ID" \
      --arg agent_type "$AGENT_TYPE" \
      --argjson duration_ms "$DURATION_MS" \
      --argjson usage "$USAGE" \
      --argjson cost "$COST" \
      '{timestamp: $ts, event: $ev, session_id: $sid, project: $project, agent_id: $agent_id, agent_type: $agent_type, duration_ms: $duration_ms, usage: $usage, estimated_cost_usd: $cost}')

    log_entry "subagents" "$ENTRY"

    push_loki "$(jq -cn \
      --arg source "claude-code" \
      --arg event "subagent" \
      --arg project "$PROJECT" \
      '{source: $source, event: $event, project: $project}')" "$ENTRY"
    ;;

  *) exit 0 ;;
esac

exit 0
