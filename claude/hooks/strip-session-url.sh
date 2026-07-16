#!/usr/bin/env bash
# PreToolUse hook for Bash:
# Block commands that contain claude.ai session URLs.
#
# Claude Code's system prompt instructs the model to append session URLs
# to commit messages and PR descriptions. The attribution setting
# {"commit":"","pr":""} in settings.json does not suppress this. This
# hook catches it at the execution layer: any bash command containing
# the URL pattern is blocked and the model is told to retry without it.
set -euo pipefail

input=$(cat)
tool=$(echo "$input" | jq -r '.tool_name // empty')

[[ "$tool" == "Bash" ]] || exit 0

command=$(echo "$input" | jq -r '.tool_input.command // empty')
[[ -n "$command" ]] || exit 0

if echo "$command" | /usr/bin/grep -qE 'claude\.ai/code/session_'; then
  cat <<'EOF'
BLOCKED: Remove the claude.ai session URL before running this command.
Strip any line matching `Claude-Session: https://claude.ai/code/session_...`
from commit messages, and any `https://claude.ai/code/session_...` URL
from PR descriptions. Then retry.
EOF
  exit 2
fi

exit 0
