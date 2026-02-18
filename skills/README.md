# Agent Skills

[Skills](https://docs.anthropic.com/en/docs/claude-code/skills) extend what your AI coding agent can do. Each skill is a `SKILL.md` file with instructions the agent follows when relevant — code review checklists, deployment workflows, package management rules, and more.

Built on the [Agent Skills](https://agentskills.io) open standard. Works with Claude Code, Copilot, Cursor, Windsurf, and other tools that support the format.

## Skills

### Code Quality

| Skill | Description | Type |
|-------|-------------|------|
| `pr-review` | Code reviews checking for bugs, security issues, performance problems, testing gaps, and code quality. Accepts branch names or PR URLs. | user-invoked |
| `codebase-audit` | Comprehensive codebase audits covering architecture, tech debt, security, test coverage, documentation, and dependencies. | user-invoked |
| `hunting-bugs` | Audits codebases for common bug patterns — timezone issues, null safety, type coercion, async handling, and performance problems. | user-invoked |
| `validate-skill` | Validates skills against official Anthropic best practices by fetching latest documentation dynamically. | user-invoked |

### Package Management

| Skill | Description | Type |
|-------|-------------|------|
| `evaluating-dependencies` | Evaluates Node.js packages before installation — bundle size impact, alternatives, latest versions, and maintenance status. | auto-invoked |
| `node-package-management` | Reference guide for npm, pnpm, yarn, and bun. Covers workspaces, security audits, troubleshooting, and migration. | reference |
| `nuget-package-management` | Manage NuGet packages using Central Package Management (CPM) and dotnet CLI. Covers workspaces, security audits, and versioning. | auto-invoked |

### DevOps

| Skill | Description | Type |
|-------|-------------|------|
| `azure-init` | Initialize local dev environment from Azure DevOps by cloning all project repositories. | user-invoked |
| `managing-ports` | Detects framework, finds available ports, and starts dev servers with correct port flags. Resolves port conflicts. | auto-invoked |

### Git & Pull Requests

| Skill | Description | Type |
|-------|-------------|------|
| `make-pr` | Creates pull requests on GitHub or Azure DevOps with auto-generated titles and descriptions. Detects platform from git remote. | user-invoked |

### Browser Automation

| Skill | Description | Type |
|-------|-------------|------|
| `chrome-devtools` | Automates headless Chrome via MCP for web scraping, screenshots, testing, and browser interactions. | user-invoked |

> **Type guide:** `user-invoked` — triggered with `/skill-name`. `auto-invoked` — activates automatically from context. `reference` — passive knowledge the agent draws on when relevant.

## Installation

### Quick install (Claude Code)

```bash
npx skills add Saturate/skills
```

### Manual

Clone and symlink each skill directory into your agent's skills folder:

```bash
git clone https://github.com/Saturate/skills.git
mkdir -p ~/.claude/skills

# Symlink all skills
for skill in skills/*/; do
  skill_name=$(basename "$skill")
  ln -s "$(pwd)/$skill" "$HOME/.claude/skills/$skill_name"
done
```

## Structure

Each skill is a directory containing:

```
skill-name/
  SKILL.md          # Instructions and triggers (required)
  references/       # Supporting docs, examples, patterns (optional)
```

## License

MIT
