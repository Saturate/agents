# Claude Configuration & Skills

Custom Claude Code skills for code reviews and codebase audits, plus personal configuration files.

## Skills

### `/pr-review` - Code Review
Performs comprehensive code reviews checking for bugs, security issues, performance problems, testing gaps, and code quality. Direct and practical feedback focused on what actually matters.

### `/codebase-audit` - Codebase Audit
Brutally honest codebase audits covering architecture, tech debt, security (OWASP Top 10), accessibility, TypeScript strict mode, monitoring/observability, and framework best practices. Includes automated scans with trufflehog, npm audit, and more.

### `/azure-init` - Azure DevOps Project Setup
Initialize local development environment from Azure DevOps by cloning all project repositories. Automatically detects namespacing patterns and organizes repos intelligently - properly namespaced repos (e.g., `Acme.Platform.Api`) go directly in `~/code/`, while non-namespaced repos (e.g., `Api`, `Frontend`) are organized in project folders. Includes dry-run mode, SSH setup guidance, and handles failures gracefully.

**Requirements:** Azure DevOps MCP connection and Git

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

This installs skills (`/pr-review`, `/codebase-audit`, and `/azure-init`), coding guidelines (`CLAUDE.md`), settings (`settings.json`), and custom statusline script.
