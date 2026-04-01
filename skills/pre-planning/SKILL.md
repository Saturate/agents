---
name: pre-planning
description: Gathers context from multiple sources before entering plan mode, including git remote work items, codebase structure, reference projects, and memories. Detects platform from git remote. Use when starting planning, before plan mode, gather context, prep for planning, kickoff, starting a new feature, beginning work on a task, or before implementing something non-trivial.
allowed-tools: Read Grep Glob Bash
metadata:
  author: Saturate
  version: "1.0"
---

# Pre-Planning Context Gathering

Don't plan in a vacuum. Gather what you need first, then feed it into plan mode.

## Progress Checklist

- [ ] Detect platform from git remote
- [ ] Gather work item / issue context
- [ ] Scan codebase for relevant patterns
- [ ] Check for reference implementations
- [ ] Check memories for past decisions
- [ ] Synthesize into context summary
- [ ] Enter plan mode with full context

## Step 1: Detect Platform

```bash
git remote get-url origin
```

| URL contains | Platform | Tools |
|-------------|----------|-------|
| `dev.azure.com` or `visualstudio.com` | Azure DevOps | Azure DevOps MCP tools or `az` CLI |
| `github.com` | GitHub | `gh` CLI |
| Everything else | Gitea / GitLab / other | Platform API or git-only |

See `references/platform-detection.md` for specific commands per platform.

## Step 2: Gather Work Item Context

If there's a work item, issue, or ticket associated with this work:

- Read the description, acceptance criteria, and comments
- Check linked items (parent epics, related bugs, blocked-by items)
- Check for linked PRs (has someone attempted this before?)
- Note assigned priority and sprint/iteration

If the branch name contains an ID (e.g., `feature/AB#1234` or `issue-42`), use that.

If no work item, skip this step.

## Step 3: Scan Codebase

Understand what already exists in the area you're about to change:

```bash
# Project structure overview
ls -la
cat package.json 2>/dev/null || cat go.mod 2>/dev/null || cat *.csproj 2>/dev/null

# Find related code
grep -r "relevantTerm" --include="*.ts" -l
```

Look for:
- Existing patterns for similar features (how is auth done? how are API endpoints structured?)
- Test patterns (what framework, where do tests live, what's the convention?)
- Shared utilities that should be reused, not reinvented
- Configuration and environment setup

## Step 4: Check Reference Implementations

Ask the user or check if there's a similar implementation in another project:

- "Have you built something like this before?"
- Check workspace for other project directories
- Look for mentions in memories of similar past work

If a reference exists, read it to understand the approach, patterns, and gotchas.

## Step 5: Check Memories

Query memory providers for:

- Past architecture decisions related to this area
- Previous approaches that worked or failed
- Known constraints or gotchas
- Client-specific preferences or requirements

## Step 6: Synthesize Context Summary

Compile everything into a focused summary:

```markdown
## Context for Planning

### Task
What we're building / fixing / changing.

### Requirements
From work item or user description.

### Existing Patterns
How similar things are done in this codebase.

### Reference
Similar implementations from other projects (if any).

### Constraints
Technical, timeline, or business limitations.

### Relevant Decisions
Past architecture decisions that affect this work.
```

## Step 7: Enter Plan Mode

With the context summary assembled, enter plan mode. The summary becomes the foundation for the plan, ensuring decisions are grounded in reality rather than assumptions.

If the task is small enough that plan mode is overkill, use the context to start implementation directly.
