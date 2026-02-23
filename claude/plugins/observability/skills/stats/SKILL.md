---
name: stats
description: Query Claude Code usage stats from observability logs. Shows costs, session summaries, tool usage, token consumption, and more. Use when asked about costs, usage, stats, spending, session history, most-used tools, or token usage. Invoked with /stats or when asking questions like "how much have I spent today?"
allowed-tools: Bash
metadata:
  author: Saturate
  version: "1.0"
---

You are querying Claude Code observability logs stored as daily-rotated JSONL files in `~/.claude/logs/`.

## Log Files

| File pattern | Contents |
|---|---|
| `tool-usage-YYYY-MM-DD.jsonl` | Pre/post tool use events + tool failures |
| `sessions-YYYY-MM-DD.jsonl` | Session start/end with token totals and cost |
| `turns-YYYY-MM-DD.jsonl` | Per-turn token usage and cost |
| `prompts-YYYY-MM-DD.jsonl` | User prompts with text and length |
| `subagents-YYYY-MM-DD.jsonl` | Subagent start/stop with duration and tokens |
| `compactions-YYYY-MM-DD.jsonl` | Context compaction events |
| `notifications-YYYY-MM-DD.jsonl` | Notification events |
| `permissions-YYYY-MM-DD.jsonl` | Permission request events |

## Date Ranges

Parse what the user asks for and build the appropriate file list:

- **Today:** `*-$(date +%Y-%m-%d).jsonl`
- **This week:** iterate from Monday to today
- **This month:** iterate from 1st to today
- **Specific date:** `*-YYYY-MM-DD.jsonl`
- **All time:** `*.jsonl` in the logs directory

Use this pattern to cat multiple days:
```bash
cat ~/.claude/logs/sessions-2026-02-{01..23}.jsonl 2>/dev/null
```

Or for cross-month ranges, generate the dates with a loop.

## Common Queries

### Cost summary

Query `sessions-*.jsonl` for `session_end` events:
```bash
cat ~/.claude/logs/sessions-$(date +%Y-%m-%d).jsonl 2>/dev/null \
  | jq -s '[.[] | select(.event == "session_end")] | {
    sessions: length,
    total_cost_usd: (map(.estimated_cost_usd // 0) | add),
    total_input_tokens: (map(.usage.input_tokens // 0) | add),
    total_output_tokens: (map(.usage.output_tokens // 0) | add),
    total_cache_read: (map(.usage.cache_read_input_tokens // 0) | add),
    avg_cache_hit_rate: (map(.cache_hit_rate // 0) | if length > 0 then add / length else 0 end),
    total_turns: (map(.turn_count // 0) | add),
    avg_duration_min: (map(.duration_s // 0) | if length > 0 then (add / length / 60) else 0 end)
  }'
```

### Cost by project

```bash
cat ~/.claude/logs/sessions-$(date +%Y-%m-%d).jsonl 2>/dev/null \
  | jq -s 'group_by(.project) | map({
    project: .[0].project,
    sessions: length,
    cost_usd: (map(select(.event == "session_end") | .estimated_cost_usd // 0) | add)
  }) | sort_by(-.cost_usd)'
```

### Most-used tools (today)

```bash
cat ~/.claude/logs/tool-usage-$(date +%Y-%m-%d).jsonl 2>/dev/null \
  | jq -s 'map(select(.event == "post")) | group_by(.tool_name) | map({
    tool: .[0].tool_name,
    count: length,
    avg_duration_ms: (map(.duration_ms // 0) | if length > 0 then (add / length | floor) else 0 end)
  }) | sort_by(-.count)'
```

### Tool failures

```bash
cat ~/.claude/logs/tool-usage-$(date +%Y-%m-%d).jsonl 2>/dev/null \
  | jq -s 'map(select(.event == "tool_failure")) | {
    total_failures: length,
    by_tool: (group_by(.tool_name) | map({tool: .[0].tool_name, count: length}) | sort_by(-.count)),
    interrupts: (map(select(.is_interrupt == true)) | length)
  }'
```

### Session list

```bash
cat ~/.claude/logs/sessions-$(date +%Y-%m-%d).jsonl 2>/dev/null \
  | jq -s 'map(select(.event == "session_end")) | map({
    session_id: .session_id[:8],
    project: .project,
    model: .model,
    duration_min: ((.duration_s // 0) / 60 | floor),
    turns: .turn_count,
    tools: .tool_count,
    cost_usd: .estimated_cost_usd,
    cache_hit: ((.cache_hit_rate // 0) * 100 | floor | tostring + "%")
  })'
```

### Current session

If the user asks about "this session" or "current session", get the session_id from the environment or from the most recent session_start entry, then filter all log files by that session_id.

```bash
# Get current/latest session ID
SID=$(cat ~/.claude/logs/sessions-$(date +%Y-%m-%d).jsonl 2>/dev/null \
  | jq -r 'select(.event == "session_start") | .session_id' | tail -1)

# Get turns for this session
cat ~/.claude/logs/turns-$(date +%Y-%m-%d).jsonl 2>/dev/null \
  | jq -s --arg sid "$SID" '[.[] | select(.session_id == $sid)] | {
    turns: length,
    total_cost_usd: (map(.estimated_cost_usd // 0) | add),
    total_tools: (map(.tool_count // 0) | add),
    total_failures: (map(.tool_failures // 0) | add)
  }'
```

### Subagent usage

```bash
cat ~/.claude/logs/subagents-$(date +%Y-%m-%d).jsonl 2>/dev/null \
  | jq -s 'map(select(.event == "subagent_stop")) | {
    total: length,
    by_type: (group_by(.agent_type) | map({type: .[0].agent_type, count: length, avg_duration_ms: (map(.duration_ms // 0) | add / length | floor)})),
    total_cost_usd: (map(.estimated_cost_usd // 0) | add)
  }'
```

### Compaction pressure

```bash
cat ~/.claude/logs/compactions-$(date +%Y-%m-%d).jsonl 2>/dev/null \
  | jq -s '{
    total_compactions: length,
    by_session: (group_by(.session_id) | map({session: .[0].session_id[:8], count: length}) | sort_by(-.count))
  }'
```

## Output Format

Present results as a clean markdown table or summary. Keep it concise. Round costs to 4 decimal places USD. Round percentages to whole numbers. Use human-readable durations (e.g., "12 min" not "720s").

If no data exists for the requested period, say so clearly rather than showing empty results.

If the user doesn't specify a time range, default to **today**.

## Arguments

Users may invoke this as:
- `/stats` — show today's cost summary
- `/stats week` — this week's summary
- `/stats tools` — most-used tools today
- `/stats sessions` — list today's sessions
- `/stats cost march` — cost for March
- Or ask naturally: "how much have I spent this week?"

Parse the intent from their message and run the appropriate queries.
