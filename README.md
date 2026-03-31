# Agents

Skills, plugins, and configuration for AI coding agents — works with Claude Code, OpenCode, and more.

## Structure

```
skills/              Shared agent skills (tool-agnostic markdown)
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
| [pr-review](skills/pr-review/) | Comprehensive code review |
| [validate-skill](skills/validate-skill/) | Validate skill files against best practices |
