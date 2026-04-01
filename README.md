# Agents

Skills, plugins, and configuration for AI coding agents. Works with Claude Code, OpenCode, and more.

## Structure

```
skills/              Shared agent skills (tool-agnostic markdown)
skills/_shared/      References shared across multiple skills
plugins/             Plugins (observability, logging)
claude/              Claude Code config (CLAUDE.md, settings, statusline)
opencode/            OpenCode config (commands, agents)
install.sh           Symlinks config for one or both tools
```

## Install

```bash
git clone https://github.com/Saturate/agents.git
cd agents

./install.sh              # Both Claude Code and OpenCode
./install.sh claude       # Claude Code only
./install.sh opencode     # OpenCode only
./install.sh --force      # Backup existing files, no prompts
```

## Claude Code Plugin

Skills are also available as a Claude Code plugin:

```
/plugin marketplace add Saturate/agents
```

The observability plugin (hook logging with optional Loki/Grafana push) can be installed separately:

```
/plugin install observability@Saturate-agents
```

## Skills

### Workflow Skills

Guide how you approach different types of work. They trigger action skills at the right moments.

| Skill | Description |
|-------|-------------|
| [idea-refine](skills/idea-refine/) | Sharpen vague ideas into actionable briefs with options and tradeoffs |
| [pre-planning](skills/pre-planning/) | Gather context from git remote, codebase, memories before planning |
| [incremental-implementation](skills/incremental-implementation/) | Build in vertical slices, verify each, commit as you go |
| [tdd](skills/tdd/) | Test-driven development with RED-GREEN-REFACTOR and prove-it pattern |
| [debugging](skills/debugging/) | Systematic debugging - follow evidence, track attempts, fix root cause |
| [code-simplification](skills/code-simplification/) | Simplify code safely with Chesterton's Fence principle |
| [frontend-ui-engineering](skills/frontend-ui-engineering/) | Component hierarchy, accessibility, performance, state handling |
| [api-design](skills/api-design/) | Contract-first API design with security focus and sane defaults |
| [performance-profiling](skills/performance-profiling/) | Measure-identify-fix-measure cycle for frontend and backend |
| [security-deep-dive](skills/security-deep-dive/) | Red team analysis, threat modeling, attack surface mapping |
| [launch-checklist](skills/launch-checklist/) | Full deployment readiness: infra, Docker, K8s, DNS, monitoring |
| [documentation-adrs](skills/documentation-adrs/) | Record architecture decisions to memory provider |
| [commit](skills/commit/) | Conventional commits with scope detection, work item linking, secret scanning |
| [code-review](skills/code-review/) | Self-review during development before PRs |

### Action Skills

Do specific things well. Often triggered by workflow skills.

| Skill | Description |
|-------|-------------|
| [azure-init](skills/azure-init/) | Initialize local dev environment from Azure DevOps |
| [chrome-devtools](skills/chrome-devtools/) | Browser automation via Chrome DevTools MCP |
| [codebase-audit](skills/codebase-audit/) | Security, architecture, and quality audit |
| [evaluating-dependencies](skills/evaluating-dependencies/) | Evaluate packages before installing |
| [hunting-bugs](skills/hunting-bugs/) | Find common bug patterns and anti-patterns |
| [make-pr](skills/make-pr/) | Create pull requests (GitHub and Azure DevOps) |
| [managing-ports](skills/managing-ports/) | Detect and resolve dev server port conflicts |
| [node-package-management](skills/node-package-management/) | npm, pnpm, yarn, and bun package management |
| [nuget-package-management](skills/nuget-package-management/) | .NET NuGet package management with CPM |
| [pr-review](skills/pr-review/) | Comprehensive PR code review |
| [validate-skill](skills/validate-skill/) | Validate skill files against best practices |
