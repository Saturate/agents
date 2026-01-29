# Claude Configuration & Skills

Custom Claude Code skills for code reviews and codebase audits, plus personal configuration files.

## Skills

| Skill | Description | Requirements |
|-------|-------------|--------------|
| `/pr-review` | Performs comprehensive code reviews checking for bugs, security issues, performance problems, testing gaps, and code quality. | Basic tools (Read, Grep, Glob, Bash) |
| `/codebase-audit` | Comprehensive codebase audits covering architecture, tech debt, security, accessibility, and framework best practices. Includes automated scans. | Basic tools (Read, Grep, Glob, Bash) |
| `/bug-hunt` | Hunts for common bug patterns including timezone issues, null safety, type coercion, async handling, and performance problems. Provides actionable fixes. | Basic tools (Read, Grep, Glob, Bash) |
| `/azure-init` | Clones all repositories from an Azure DevOps project and organizes them locally based on namespacing patterns. | Azure DevOps MCP, Git |
| `/make-pr` | Creates pull requests on GitHub or Azure DevOps with auto-generated titles and descriptions. Detects platform and generates context-aware PR content. | Git, `gh` CLI (GitHub) or `az` CLI (Azure) |
| `/validate-skill` | Validates Claude Code skills against official Anthropic best practices by fetching the latest documentation. Generates detailed reports. | Read, Grep, Glob, WebFetch |

## Quick Install

### Install Skills Only

```bash
npx skills add Saturate/claude
```

### Install Everything (Skills + Config)

For personal use, clone and run the install script to symlink everything to `~/.claude/`:

```bash
git clone https://github.com/Saturate/claude.git
cd claude
./install.sh              # Interactive mode (prompts for existing files)
./install.sh --force      # Backup existing files and create symlinks
./install.sh --skip-existing   # Skip existing files
```

This installs skills (`/pr-review`, `/codebase-audit`, `/bug-hunt`, `/azure-init`, `/make-pr`, and `/validate-skill`), coding guidelines (`CLAUDE.md`), settings (`settings.json`), and custom statusline script.
