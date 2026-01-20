#!/bin/bash

# Read JSON input from stdin
input=$(cat)

# Extract values
dir=$(echo "$input" | jq -r '.workspace.current_dir')
model_name=$(echo "$input" | jq -r '.model.display_name')
context_window=$(echo "$input" | jq -r '.context_window')

# Replace home directory with ~
dir="${dir/#$HOME/~}"

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

    printf "%s (%s - %d%% - \$%s)" "$dir" "$model_short" "$pct" "$total_cost"
else
    # No usage data yet
    printf "%s (%s - 0%% - \$0.00)" "$dir" "$model_short"
fi
