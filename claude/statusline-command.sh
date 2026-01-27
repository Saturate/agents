#!/bin/bash

# Read JSON input from stdin
input=$(cat)

# Extract values
current_dir=$(echo "$input" | jq -r '.workspace.current_dir')
project_dir=$(echo "$input" | jq -r '.workspace.project_dir')
model_name=$(echo "$input" | jq -r '.model.display_name')
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

# Simplify model name (e.g., "Claude 3.5 Sonnet" -> "Sonnet 3.5")
if [[ "$model_name" == *"Sonnet"* ]]; then
    if [[ "$model_name" == *"4.5"* ]]; then
        model_short="Sonnet 4.5"
    elif [[ "$model_name" == *"3.7"* ]]; then
        model_short="Sonnet 3.7"
    elif [[ "$model_name" == *"3.5"* ]]; then
        model_short="Sonnet 3.5"
    else
        model_short="Sonnet"
    fi
elif [[ "$model_name" == *"Opus"* ]]; then
    if [[ "$model_name" == *"4.5"* ]]; then
        model_short="Opus 4.5"
    elif [[ "$model_name" == *"4"* ]]; then
        model_short="Opus 4"
    else
        model_short="Opus"
    fi
elif [[ "$model_name" == *"Haiku"* ]]; then
    if [[ "$model_name" == *"3.7"* ]]; then
        model_short="Haiku 3.7"
    elif [[ "$model_name" == *"3.5"* ]]; then
        model_short="Haiku 3.5"
    else
        model_short="Haiku"
    fi
else
    model_short="$model_name"
fi

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

    # Calculate cost based on model (using cumulative totals)
    # Pricing per million tokens (as of January 2025)
    if [[ "$model_short" == "Sonnet 4.5" ]]; then
        # Claude 3.5 Sonnet: $3 input, $15 output per MTok
        input_cost=$(awk "BEGIN {printf \"%.4f\", $total_input * 3 / 1000000}")
        output_cost=$(awk "BEGIN {printf \"%.4f\", $total_output * 15 / 1000000}")
    elif [[ "$model_short" == "Opus 4.5" ]]; then
        # Claude Opus 4.5: $15 input, $75 output per MTok
        input_cost=$(awk "BEGIN {printf \"%.4f\", $total_input * 15 / 1000000}")
        output_cost=$(awk "BEGIN {printf \"%.4f\", $total_output * 75 / 1000000}")
    elif [[ "$model_short" == "Haiku 3.5" ]]; then
        # Claude 3.5 Haiku: $0.80 input, $4 output per MTok
        input_cost=$(awk "BEGIN {printf \"%.4f\", $total_input * 0.80 / 1000000}")
        output_cost=$(awk "BEGIN {printf \"%.4f\", $total_output * 4 / 1000000}")
    elif [[ "$model_short" == "Sonnet 3.7" ]]; then
        # Claude 3.7 Sonnet: $3 input, $15 output per MTok
        input_cost=$(awk "BEGIN {printf \"%.4f\", $total_input * 3 / 1000000}")
        output_cost=$(awk "BEGIN {printf \"%.4f\", $total_output * 15 / 1000000}")
    else
        # Default to Sonnet 3.5 pricing
        input_cost=$(awk "BEGIN {printf \"%.4f\", $total_input * 3 / 1000000}")
        output_cost=$(awk "BEGIN {printf \"%.4f\", $total_output * 15 / 1000000}")
    fi

    total_cost=$(awk "BEGIN {printf \"%.2f\", $input_cost + $output_cost}")

    printf "%s%s (%s - %d%% - \$%s)" "$dir_display" "$git_info" "$model_short" "$pct" "$total_cost"
else
    # No usage data yet
    printf "%s%s (%s - 0%% - \$0.00)" "$dir_display" "$git_info" "$model_short"
fi
