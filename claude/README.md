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

### `/make-pr` - Pull Request Creation
Creates pull requests on GitHub or Azure DevOps with smart platform detection and auto-generated descriptions. Analyzes your commits to generate PR titles and descriptions following CLAUDE.md style: casual engineer tone, explains WHY not WHAT, no robot speak. Supports reviewers, labels (GitHub), work items (Azure), and draft PRs.

**Requirements:** Git repository with `gh` CLI (GitHub) or `az` CLI + azure-devops extension (Azure DevOps)

### `/validate-skill` - Skill Quality Validator
Validates Claude Code skills against official Anthropic best practices. Checks frontmatter format, line count, description quality, reference structure, workflows, and anti-patterns. Generates comprehensive reports with scores, specific issues, and actionable recommendations. Perfect for ensuring your skills follow Claude Code standards before sharing.

**Requirements:** Read, Grep, Glob tools for file analysis

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

This installs skills (`/pr-review`, `/codebase-audit`, `/azure-init`, `/make-pr`, and `/validate-skill`), coding guidelines (`CLAUDE.md`), settings (`settings.json`), and custom statusline script.
