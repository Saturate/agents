#!/bin/bash

# Read JSON input from stdin
input=$(cat)

# Extract values
current_dir=$(echo "$input" | jq -r '.workspace.current_dir')
project_dir=$(echo "$input" | jq -r '.workspace.project_dir')
model_name=$(echo "$input" | jq -r '.model.id')
context_window=$(echo "$input" | jq -r '.context_window')

# Keep original dirs for git commands
current_full="$current_dir"
project_full="$project_dir"

# Create display path with ~ substitution
project_display="${project_dir/#$HOME/~}"
current_display="${current_dir/#$HOME/~}"

# Check if current dir is within project dir
if [ "$current_dir" = "$project_dir" ]; then
    # At project root
    dir_display="$project_display"
    dir_full="$project_full"
elif [[ "$current_dir" == "$project_dir"/* ]]; then
    # Inside project: show relative path
    rel_path="${current_dir#$project_dir/}"
    dir_display="$project_display:$rel_path"
    dir_full="$current_full"
else
    # Outside project: show both directories
    dir_display="$project_display → $current_display"
    dir_full="$current_full"
fi

# Get git branch and status
git_info=""
if git -C "$dir_full" rev-parse --git-dir > /dev/null 2>&1; then
    # Get current branch name
    branch=$(git -C "$dir_full" symbolic-ref --short HEAD 2>/dev/null || git -C "$dir_full" rev-parse --short HEAD 2>/dev/null)

    # Check for uncommitted changes
    if git -C "$dir_full" diff-index --quiet HEAD -- 2>/dev/null; then
        # Clean
        status="✓"
    else
        # Dirty
        status="✗"
    fi

    # Check ahead/behind
    upstream=$(git -C "$dir_full" rev-parse --abbrev-ref --symbolic-full-name @{u} 2>/dev/null)
    if [ -n "$upstream" ]; then
        ahead=$(git -C "$dir_full" rev-list --count @{u}..HEAD 2>/dev/null || echo 0)
        behind=$(git -C "$dir_full" rev-list --count HEAD..@{u} 2>/dev/null || echo 0)

        if [ "$ahead" -gt 0 ] && [ "$behind" -gt 0 ]; then
            status="$status ↑$ahead↓$behind"
        elif [ "$ahead" -gt 0 ]; then
            status="$status ↑$ahead"
        elif [ "$behind" -gt 0 ]; then
            status="$status ↓$behind"
        fi
    fi

    git_info=" [$branch $status]"
fi

# Use full model ID directly (e.g., "claude-sonnet-4-6")
model_short="$model_name"

# Calculate context usage percentage and cost
usage=$(echo "$context_window" | jq '.current_usage')
if [ "$usage" != "null" ]; then
    # Get token counts
    input_tokens=$(echo "$usage" | jq '.input_tokens // 0')
    cache_creation=$(echo "$usage" | jq '.cache_creation_input_tokens // 0')
    cache_read=$(echo "$usage" | jq '.cache_read_input_tokens // 0')
    output_tokens=$(echo "$usage" | jq '.output_tokens // 0')

    # Get total tokens from session (cumulative)
    total_input=$(echo "$context_window" | jq '.total_input_tokens // 0')
    total_output=$(echo "$context_window" | jq '.total_output_tokens // 0')

    # Calculate context percentage (current context, not cumulative)
    current_tokens=$((input_tokens + cache_creation + cache_read))
    context_size=$(echo "$context_window" | jq '.context_window_size // 0')

    # Avoid division by zero
    if [ "$context_size" -gt 0 ]; then
        pct=$((current_tokens * 100 / context_size))
    else
        pct=0
    fi

    # Calculate cost based on model ID (using cumulative totals)
    # Pricing per million tokens (4.5/4.6 rates)
    if [[ "$model_short" == *"opus"* ]]; then
        input_cost=$(awk "BEGIN {printf \"%.4f\", $total_input * 5 / 1000000}")
        output_cost=$(awk "BEGIN {printf \"%.4f\", $total_output * 25 / 1000000}")
    elif [[ "$model_short" == *"haiku"* ]]; then
        input_cost=$(awk "BEGIN {printf \"%.4f\", $total_input * 1 / 1000000}")
        output_cost=$(awk "BEGIN {printf \"%.4f\", $total_output * 5 / 1000000}")
    else
        input_cost=$(awk "BEGIN {printf \"%.4f\", $total_input * 3 / 1000000}")
        output_cost=$(awk "BEGIN {printf \"%.4f\", $total_output * 15 / 1000000}")
    fi

    total_cost=$(awk "BEGIN {printf \"%.2f\", $input_cost + $output_cost}")

    # Format token counts (e.g. 1.2k, 3.4M)
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
    in_fmt=$(fmt_tokens "$total_input")
    out_fmt=$(fmt_tokens "$total_output")

    printf "%s%s (%s - %d%% - %s↑ %s↓ - \$%s)" "$dir_display" "$git_info" "$model_short" "$pct" "$in_fmt" "$out_fmt" "$total_cost"
else
    # No usage data yet
    printf "%s%s (%s - 0%% - 0↑ 0↓ - \$0.00)" "$dir_display" "$git_info" "$model_short"
fi
