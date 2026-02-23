#!/bin/bash
#
# Shared library for Claude Code hook scripts.
# Sourced (not executed) by each per-event script.
#
# Provides: stdin capture, field extraction, project detection,
# timestamps, JSONL logging, Loki push, token cost calculation,
# and transcript parsing.
#
# Usage: source "$(dirname "$0")/lib.sh"
#

set -uo pipefail

# ── Directories ──────────────────────────────────────────────────────────────

LOG_DIR="$HOME/.claude/logs"
TIMING_DIR="/tmp/claude-hook-timings"
mkdir -p "$LOG_DIR" "$TIMING_DIR"

# Loki endpoint — fully env-var driven, no-op when unset.
# Set LOKI_URL, LOKI_USER, LOKI_PASS in your shell profile.
LOKI_URL="${LOKI_URL:-}"

# ── Stdin capture ────────────────────────────────────────────────────────────
# Read hook input once; all scripts access $_HOOK_INPUT_FILE.

_HOOK_INPUT_FILE=$(mktemp)
trap 'rm -f "$_HOOK_INPUT_FILE"; exit 0' EXIT ERR
cat > "$_HOOK_INPUT_FILE"

# ── Field extraction ─────────────────────────────────────────────────────────

hook_field() {
  jq -r ".$1 // empty" < "$_HOOK_INPUT_FILE"
}

HOOK_EVENT=$(hook_field hook_event_name)
SESSION_ID=$(hook_field session_id)
CWD=$(hook_field cwd)
TRANSCRIPT_PATH=$(hook_field transcript_path)

# ── Project detection ────────────────────────────────────────────────────────
# git remote → transcript path slug → cwd basename

GIT_REMOTE=""
GIT_BRANCH=""
if [ -n "$CWD" ] && git -C "$CWD" rev-parse --git-dir >/dev/null 2>&1; then
  GIT_REMOTE=$(git -C "$CWD" remote get-url origin 2>/dev/null | sed 's|.*/||; s|\.git$||') || true
  GIT_BRANCH=$(git -C "$CWD" symbolic-ref --short HEAD 2>/dev/null || git -C "$CWD" rev-parse --short HEAD 2>/dev/null) || true
fi

PROJECT=""
[ -n "$GIT_REMOTE" ] && PROJECT="$GIT_REMOTE"
if [ -z "$PROJECT" ] && [ -n "$TRANSCRIPT_PATH" ]; then
  PROJECT=$(echo "$TRANSCRIPT_PATH" | sed 's|.*/projects/||; s|/.*||; s|.*-||')
fi
[ -z "$PROJECT" ] && PROJECT="${CWD##*/}"

# ── Timestamps ───────────────────────────────────────────────────────────────

utc_timestamp() {
  date -u +%Y-%m-%dT%H:%M:%SZ
}

nano_timestamp() {
  # macOS lacks date +%N; use perl for nanosecond-ish precision
  perl -MTime::HiRes=time -e 'printf "%.0f\n", time * 1e9' 2>/dev/null || date +%s000000000
}

# ── JSONL logging ────────────────────────────────────────────────────────────
# log_entry <category> <json_string>
# Appends to ~/.claude/logs/{category}-YYYY-MM-DD.jsonl

log_entry() {
  local category="$1"
  local json="$2"
  local file="$LOG_DIR/${category}-$(date +%Y-%m-%d).jsonl"
  echo "$json" >> "$file"
}

# ── Loki push ────────────────────────────────────────────────────────────────
# push_loki <labels_json> <log_line>
# Backgrounded curl, never blocks. Requires LOKI_USER + LOKI_PASS.

push_loki() {
  local labels="$1"
  local line="$2"

  [ -z "${LOKI_URL:-}" ] || [ -z "${LOKI_USER:-}" ] || [ -z "${LOKI_PASS:-}" ] && return 0

  local ts
  ts="$(date +%s)000000000"

  local payload
  payload=$(jq -cn \
    --argjson labels "$labels" \
    --arg ts "$ts" \
    --arg line "$line" \
    '{streams: [{stream: $labels, values: [[$ts, $line]]}]}')

  curl -s -u "$LOKI_USER:$LOKI_PASS" \
    "$LOKI_URL" \
    -H "Content-Type: application/json" \
    -d "$payload" \
    >/dev/null 2>&1 &
}

# ── Model pricing ────────────────────────────────────────────────────────────
# Returns "input_rate output_rate" per million tokens

model_pricing() {
  local model="$1"
  case "$model" in
    *opus*)   echo "15.00 75.00" ;;
    *sonnet*) echo "3.00 15.00" ;;
    *haiku*)  echo "0.80 4.00" ;;
    *)        echo "3.00 15.00" ;; # default to sonnet
  esac
}

# ── Cost calculation ─────────────────────────────────────────────────────────
# calculate_cost <model> <input_tokens> <output_tokens> <cache_read> <cache_create>

calculate_cost() {
  local model="$1"
  local input="${2:-0}"
  local output="${3:-0}"
  local cache_read="${4:-0}"
  local cache_create="${5:-0}"

  local rates
  rates=$(model_pricing "$model")
  local input_rate output_rate
  input_rate=$(echo "$rates" | awk '{print $1}')
  output_rate=$(echo "$rates" | awk '{print $2}')

  awk -v inp="$input" -v out="$output" -v cr="$cache_read" -v cc="$cache_create" \
      -v ir="$input_rate" -v or_="$output_rate" \
      'BEGIN {
        # cache_read is 90% discount, cache_create is 25% surcharge
        cost = (inp * ir / 1000000) + (out * or_ / 1000000) + (cr * ir * 0.1 / 1000000) + (cc * ir * 1.25 / 1000000)
        printf "%.6f\n", cost
      }'
}

# ── Transcript parsing ───────────────────────────────────────────────────────

# parse_transcript_totals <path>
# Sums all assistant message usage from the full transcript.
# Two-pass jq: streams line-by-line, then slurps extracted objects.
# ~40ms on a 5MB transcript.
parse_transcript_totals() {
  local path="$1"
  [ -f "$path" ] || { echo '{}'; return; }

  jq -c '
    select(.type == "assistant")
    | .message.usage // empty
    | {input_tokens, output_tokens, cache_read_input_tokens, cache_creation_input_tokens}
  ' < "$path" 2>/dev/null | jq -sc '
    . as $arr
    | reduce $arr[] as $u ({input_tokens:0, output_tokens:0, cache_read_input_tokens:0, cache_creation_input_tokens:0};
      .input_tokens += ($u.input_tokens // 0)
      | .output_tokens += ($u.output_tokens // 0)
      | .cache_read_input_tokens += ($u.cache_read_input_tokens // 0)
      | .cache_creation_input_tokens += ($u.cache_creation_input_tokens // 0)
    )
    | . + {turn_count: ($arr | length)}
  ' 2>/dev/null || echo '{}'
}

# parse_last_turn_usage <path>
# Extracts usage from the last assistant message. ~4ms via tail.
parse_last_turn_usage() {
  local path="$1"
  [ -f "$path" ] || { echo '{}'; return; }

  tail -50 "$path" 2>/dev/null | jq -c '
    select(.type == "assistant")
    | .message.usage // empty
    | {input_tokens, output_tokens, cache_read_input_tokens, cache_creation_input_tokens}
  ' 2>/dev/null | tail -1 || echo '{}'
}
