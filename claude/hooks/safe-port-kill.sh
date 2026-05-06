#!/usr/bin/env bash
# PreToolUse hook for Bash: block dangerous port-killing patterns that
# nuke browsers and other innocent bystanders.
#
# The problem: `kill $(lsof -ti :PORT)` kills EVERY process with a
# connection on that port — including Firefox, Chrome, etc.
#
# The fix: only target the LISTEN-ing process (the server), not clients.

set -euo pipefail

# Read the tool input JSON from stdin
input=$(cat)
command=$(echo "$input" | jq -r '.tool_input.command // empty')

# Nothing to check if no command
[[ -z "$command" ]] && exit 0

# Patterns that kill by port without filtering to LISTEN-only
# These catch browsers, databases, and anything else connected to that port
dangerous_patterns=(
  'kill.*\$\(lsof -ti'          # kill $(lsof -ti :PORT) — no LISTEN filter
  'kill.*\$\(lsof -t -i'        # kill $(lsof -t -i :PORT) — spaced flag variant
  'lsof -ti.*\| *xargs kill'    # lsof -ti :PORT | xargs kill — pipe variant
  'lsof -t -i.*\| *xargs kill'  # lsof -t -i :PORT | xargs kill — pipe variant
  'kill.*\$\(fuser'              # kill $(fuser PORT/tcp)
  'fuser -k'                     # fuser --kill
  'fuser --kill'                 # fuser --kill
)

# Check if command matches any dangerous pattern
for pattern in "${dangerous_patterns[@]}"; do
  if echo "$command" | grep -qE "$pattern"; then
    # Check if it already has the -sTCP:LISTEN safety filter
    if echo "$command" | grep -q 'sTCP:LISTEN'; then
      exit 0  # Already safe
    fi

    cat <<'EOF'
BLOCKED: This command kills ALL processes on a port, including browsers.

`lsof -ti :PORT` returns PIDs for every connection — Firefox with an open
tab to localhost:PORT will be killed too.

Safe alternatives:
  # Only kill the server (LISTEN-ing process), not clients:
  kill $(lsof -ti :PORT -sTCP:LISTEN)

  # Or target by process name:
  pkill -f 'node.*storybook'

  # Or use the managing-ports skill which has protected-process checks:
  /managing-ports --kill PORT
EOF
    exit 2  # Block the command
  fi
done

exit 0
