# Observability Plugin

Tracks every Claude Code hook event to daily-rotated JSONL files in `~/.claude/logs/`. Optionally pushes to Loki for Grafana dashboards.

## Install

Via the Claude Code plugin marketplace:

```
/plugin marketplace add Saturate/agents
/plugin install observability@Saturate-agents
```

Or via the repo install script:

```bash
./install.sh
```

## What it logs

| Event | File | Contents |
|-------|------|----------|
| `PreToolUse` / `PostToolUse` | `tool-usage-YYYY-MM-DD.jsonl` | Tool name, duration, success/failure |
| `PostToolUseFailure` | `tool-usage-YYYY-MM-DD.jsonl` | Tool name, error, interrupt flag |
| `SessionStart` / `SessionEnd` | `sessions-YYYY-MM-DD.jsonl` | Token totals, cost, model, duration |
| `Stop` | `turns-YYYY-MM-DD.jsonl` | Per-turn tokens, cost, tool count |
| `UserPromptSubmit` | `prompts-YYYY-MM-DD.jsonl` | Prompt text, length |
| `SubagentStart` / `SubagentStop` | `subagents-YYYY-MM-DD.jsonl` | Agent type, duration, tokens |
| `PreCompact` | `compactions-YYYY-MM-DD.jsonl` | Session, context size |
| `PostCompact` | `compactions-YYYY-MM-DD.jsonl` | Session, post-compaction state |
| `StopFailure` | `turns-YYYY-MM-DD.jsonl` | API errors that killed a turn |
| `PostToolBatch` | `tool-usage-YYYY-MM-DD.jsonl` | Parallel tool call batch results |
| `PermissionDenied` | `permissions-YYYY-MM-DD.jsonl` | Tool, denied reason |
| `TaskCreated` | `tasks-YYYY-MM-DD.jsonl` | Task creation details |
| `InstructionsLoaded` | `configs-YYYY-MM-DD.jsonl` | CLAUDE.md/rules file loaded |
| `Notification` | `notifications-YYYY-MM-DD.jsonl` | Notification content |
| `PermissionRequest` | `permissions-YYYY-MM-DD.jsonl` | Tool, path, decision |
| `ConfigChange` | `configs-YYYY-MM-DD.jsonl` | Changed config key/value |
| `WorktreeCreate` / `WorktreeRemove` | `worktrees-YYYY-MM-DD.jsonl` | Worktree path, branch |
| `TaskCompleted` / `TeammateIdle` | `tasks-YYYY-MM-DD.jsonl` | Task summary |

All files are appended line-by-line (JSONL). Each entry includes `session_id`, `project`, `timestamp`, and relevant event fields.

## Loki push

Set these environment variables to enable Loki push alongside local logging:

```bash
export LOKI_URL="https://your-loki-instance/loki/api/v1/push"
export LOKI_USER="your-user"
export LOKI_PASS="your-api-key"
```

Push is fire-and-forget (backgrounded). Failures are written to `~/.claude/logs/loki-errors-YYYY-MM-DD.jsonl` and do not affect normal operation.

## Querying logs

The plugin ships with a `/stats` skill for querying from within Claude Code:

```
/stats              # today's cost summary
/stats week         # this week
/stats tools        # most-used tools today
/stats sessions     # list today's sessions
/stats cost march   # cost for a specific month
```

Or ask naturally: "how much have I spent this week?"

### Manual queries

Cost summary for today:

```bash
cat ~/.claude/logs/turns-$(date +%Y-%m-%d).jsonl \
  | jq -s '{
    turns: length,
    total_cost_usd: (map(.estimated_cost_usd // 0) | add),
    sessions: (map(.session_id) | unique | length)
  }'
```

Most-used tools:

```bash
cat ~/.claude/logs/tool-usage-$(date +%Y-%m-%d).jsonl \
  | jq -s 'map(select(.event == "post")) | group_by(.tool_name) | map({
    tool: .[0].tool_name,
    count: length,
    avg_duration_ms: (map(.duration_ms // 0) | add / length | floor)
  }) | sort_by(-.count)'
```

Cost by project:

```bash
cat ~/.claude/logs/turns-$(date +%Y-%m-%d).jsonl \
  | jq -s 'group_by(.project) | map({
    project: .[0].project,
    cost_usd: (map(.estimated_cost_usd // 0) | add),
    turns: length
  }) | sort_by(-.cost_usd)'
```

## Cost calculation

Token costs are estimated using Anthropic's published rates at the time of the last update:

| Model | Input (per 1M) | Output (per 1M) |
|-------|---------------|----------------|
| Opus | $5.00 | $25.00 |
| Sonnet | $3.00 | $15.00 |
| Haiku | $1.00 | $5.00 |

Cache reads apply a 90% discount. Cache writes apply a 25% surcharge. These are estimates; check your Anthropic console for billing.

## Log rotation

Files rotate daily by date suffix. There is no automatic cleanup. Remove old files manually or with a cron job:

```bash
find ~/.claude/logs -name "*.jsonl" -mtime +30 -delete
```
