#!/bin/bash

# Read JSON input from stdin
input=$(cat)

# Uncomment to dump raw JSON input for debugging
# echo "$input" | jq . > /tmp/claude-statusline-debug.json 2>/dev/null

# ── Colors ────────────────────────────────────────────────────────
RST="\033[0m"
BOLD="\033[1m"
DIM="\033[2m"
# Foreground
FG_RED="\033[31m"
FG_GREEN="\033[32m"
FG_YELLOW="\033[33m"
FG_MAGENTA="\033[35m"
FG_CYAN="\033[36m"
# Bright foreground
FG_BRED="\033[91m"
FG_BGREEN="\033[92m"
FG_BYELLOW="\033[93m"
FG_BBLUE="\033[94m"
FG_BMAGENTA="\033[95m"
FG_BCYAN="\033[96m"

# ── Extract values ────────────────────────────────────────────────
current_dir=$(echo "$input" | jq -r '.workspace.current_dir')
project_dir=$(echo "$input" | jq -r '.workspace.project_dir')
model_name=$(echo "$input" | jq -r '.model.id')
model_display=$(echo "$input" | jq -r '.model.display_name // .model.id')
context_window=$(echo "$input" | jq -r '.context_window')
cost_data=$(echo "$input" | jq -r '.cost // empty')
rate_limits=$(echo "$input" | jq -r '.rate_limits // empty')

# ── Directory display ─────────────────────────────────────────────
project_display="${project_dir/#$HOME/~}"
current_display="${current_dir/#$HOME/~}"
project_name=$(basename "$project_dir")
dir_full="$current_dir"

if [ "$current_dir" = "$project_dir" ]; then
    dir_display="${FG_BCYAN}${project_display}${RST}"
elif [[ "$current_dir" == "$project_dir"/* ]]; then
    rel_path="${current_dir#$project_dir/}"
    dir_display="${FG_BCYAN}${project_display}/${FG_BGREEN}${rel_path}${RST}"
else
    dir_display="${FG_BCYAN}${project_display}${RST} > ${FG_BYELLOW}${current_display}${RST}"
fi

# ── Git info ──────────────────────────────────────────────────────
git_segment=""
if git -C "$dir_full" rev-parse --git-dir > /dev/null 2>&1; then
    branch=$(git -C "$dir_full" symbolic-ref --short HEAD 2>/dev/null || git -C "$dir_full" rev-parse --short HEAD 2>/dev/null)

    dirty=""
    if ! git -C "$dir_full" diff-index --quiet HEAD -- 2>/dev/null; then
        dirty=" !"
    fi

    ab=""
    upstream=$(git -C "$dir_full" rev-parse --abbrev-ref --symbolic-full-name @{u} 2>/dev/null)
    if [ -n "$upstream" ]; then
        ahead=$(git -C "$dir_full" rev-list --count @{u}..HEAD 2>/dev/null || echo 0)
        behind=$(git -C "$dir_full" rev-list --count HEAD..@{u} 2>/dev/null || echo 0)
        [ "$ahead" -gt 0 ] && ab="${ab}↑${ahead}"
        [ "$behind" -gt 0 ] && ab="${ab}↓${behind}"
        [ -n "$ab" ] && ab=" $ab"
    fi

    git_segment="${FG_BMAGENTA} ${branch}${FG_YELLOW}${dirty}${FG_CYAN}${ab}${RST}"
fi

# ── Progress bar helper ───────────────────────────────────────────
make_bar() {
    local pct=$1
    local width=${2:-10}
    local filled=$((pct * width / 100))
    [ "$filled" -gt "$width" ] && filled=$width
    local empty=$((width - filled))

    local color="$FG_BGREEN"
    [ "$pct" -ge 50 ] && color="$FG_BYELLOW"
    [ "$pct" -ge 75 ] && color="$FG_YELLOW"
    [ "$pct" -ge 90 ] && color="$FG_BRED"

    local bar="${color}"
    for ((i=0; i<filled; i++)); do bar+="━"; done
    bar+="${DIM}"
    for ((i=0; i<empty; i++)); do bar+="┄"; done
    bar+="${RST}"
    echo -ne "$bar"
}

# ── Format tokens ─────────────────────────────────────────────────
fmt_tokens() {
    local t=$1
    if [ "$t" -ge 1000000 ]; then
        awk "BEGIN {printf \"%.1fM\", $t / 1000000}"
    elif [ "$t" -ge 1000 ]; then
        awk "BEGIN {printf \"%.1fk\", $t / 1000}"
    else
        echo "$t"
    fi
}

# ── Model display ─────────────────────────────────────────────────
# Use display_name and strip the context suffix, e.g. "Opus 4.6 (1M context)" -> "opus 4.6"
model_short=$(echo "$model_display" | sed 's/ *(.*//' | tr '[:upper:]' '[:lower:]')

if [[ "$model_short" == *"opus"* ]]; then
    model_color="$FG_MAGENTA"
elif [[ "$model_short" == *"haiku"* ]]; then
    model_color="$FG_GREEN"
else
    model_color="$FG_CYAN"
fi

ctx_size=$(echo "$context_window" | jq '.context_window_size // 0')
if [ "$ctx_size" -ge 1000000 ]; then
    ctx_label="1M"
else
    ctx_label="200k"
fi
model_segment="${model_color}${model_short}${RST}${DIM}/${ctx_label}${RST}"

# ── Context usage ─────────────────────────────────────────────────
usage=$(echo "$context_window" | jq '.current_usage // empty')
ctx_pct=0
in_fmt="0"
out_fmt="0"
total_cost="0.00"

if [ -n "$usage" ] && [ "$usage" != "null" ]; then
    input_tokens=$(echo "$usage" | jq '.input_tokens // 0')
    cache_creation=$(echo "$usage" | jq '.cache_creation_input_tokens // 0')
    cache_read=$(echo "$usage" | jq '.cache_read_input_tokens // 0')
    total_input=$(echo "$context_window" | jq '.total_input_tokens // 0')
    total_output=$(echo "$context_window" | jq '.total_output_tokens // 0')

    current_tokens=$((input_tokens + cache_creation + cache_read))
    if [ "$ctx_size" -gt 0 ]; then
        ctx_pct=$((current_tokens * 100 / ctx_size))
    fi

    in_fmt=$(fmt_tokens "$total_input")
    out_fmt=$(fmt_tokens "$total_output")

    # Cost from API data if available, else calculate
    if [ -n "$cost_data" ] && [ "$cost_data" != "null" ]; then
        total_cost=$(echo "$cost_data" | jq -r '.total_cost_usd // 0' | awk '{printf "%.2f", $1}')
    else
        if [[ "$model_name" == *"opus"* ]]; then
            ic=$(awk "BEGIN {printf \"%.4f\", $total_input * 5 / 1000000}")
            oc=$(awk "BEGIN {printf \"%.4f\", $total_output * 25 / 1000000}")
        elif [[ "$model_name" == *"haiku"* ]]; then
            ic=$(awk "BEGIN {printf \"%.4f\", $total_input * 1 / 1000000}")
            oc=$(awk "BEGIN {printf \"%.4f\", $total_output * 5 / 1000000}")
        else
            ic=$(awk "BEGIN {printf \"%.4f\", $total_input * 3 / 1000000}")
            oc=$(awk "BEGIN {printf \"%.4f\", $total_output * 15 / 1000000}")
        fi
        total_cost=$(awk "BEGIN {printf \"%.2f\", $ic + $oc}")
    fi
fi

ctx_bar=$(make_bar "$ctx_pct" 12)
ctx_segment="${FG_CYAN}ctx${RST} ${ctx_bar} ${DIM}${ctx_pct}%${RST}"

# ── Token stats ───────────────────────────────────────────────────
token_segment="${FG_GREEN}${in_fmt}${RST} ${FG_YELLOW}${out_fmt}${RST}"

# ── Cost ──────────────────────────────────────────────────────────
cost_color="$FG_BGREEN"
cost_val=$(echo "$total_cost" | awk '{print $1 + 0}')
if (( $(echo "$cost_val > 1" | bc -l 2>/dev/null || echo 0) )); then
    cost_color="$FG_BYELLOW"
fi
if (( $(echo "$cost_val > 5" | bc -l 2>/dev/null || echo 0) )); then
    cost_color="$FG_BRED"
fi
cost_segment="${cost_color}\$${total_cost}${RST}"

# ── Duration ──────────────────────────────────────────────────────
duration_segment=""
if [ -n "$cost_data" ] && [ "$cost_data" != "null" ]; then
    dur_ms=$(echo "$cost_data" | jq '.total_duration_ms // 0')
    if [ "$dur_ms" -gt 0 ] 2>/dev/null; then
        dur_s=$((dur_ms / 1000))
        if [ "$dur_s" -ge 3600 ]; then
            dur_h=$((dur_s / 3600))
            dur_m=$(( (dur_s % 3600) / 60 ))
            duration_segment="${DIM}${dur_h}h${dur_m}m${RST}"
        elif [ "$dur_s" -ge 60 ]; then
            dur_m=$((dur_s / 60))
            dur_rem=$((dur_s % 60))
            duration_segment="${DIM}${dur_m}m${dur_rem}s${RST}"
        else
            duration_segment="${DIM}${dur_s}s${RST}"
        fi
    fi
fi

# ── Rate limits ───────────────────────────────────────────────────
rate_segment=""
if [ -n "$rate_limits" ] && [ "$rate_limits" != "null" ]; then
    five_hr=$(echo "$rate_limits" | jq '.five_hour.used_percentage // empty')
    seven_day=$(echo "$rate_limits" | jq '.seven_day.used_percentage // empty')

    if [ -n "$five_hr" ] && [ "$five_hr" != "null" ]; then
        five_hr_int=$(printf "%.0f" "$five_hr")
        five_bar=$(make_bar "$five_hr_int" 8)
        rate_segment="${FG_MAGENTA}5h${RST} ${five_bar} ${DIM}${five_hr_int}%${RST}"
    fi

    if [ -n "$seven_day" ] && [ "$seven_day" != "null" ]; then
        seven_day_int=$(printf "%.0f" "$seven_day")
        seven_bar=$(make_bar "$seven_day_int" 8)
        if [ -n "$rate_segment" ]; then
            rate_segment="${rate_segment}  ${FG_MAGENTA}7d${RST} ${seven_bar} ${DIM}${seven_day_int}%${RST}"
        else
            rate_segment="${FG_MAGENTA}7d${RST} ${seven_bar} ${DIM}${seven_day_int}%${RST}"
        fi
    fi
fi

# ── Separators ────────────────────────────────────────────────────
SEP="${DIM} │ ${RST}"

# ── Line 1: model + directory + git ──────────────────────────────
line1="${model_segment}${SEP}${dir_display}${git_segment}"

# ── Line 2: context bar + tokens + cost + duration + rate limits ─
line2="${ctx_segment}${SEP}${token_segment}${SEP}${cost_segment}"

if [ -n "$duration_segment" ]; then
    line2="${line2}${SEP}${duration_segment}"
fi

if [ -n "$rate_segment" ]; then
    line2="${line2}${SEP}${rate_segment}"
fi

# ── Output ────────────────────────────────────────────────────────
echo -e "${line1}\n${line2}"
