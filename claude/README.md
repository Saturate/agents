# Claude Configuration

Personal Claude Code configuration — coding guidelines, settings, hooks, and statusline.

Skills live in a dedicated repo: **[Saturate/skills](https://github.com/Saturate/skills)** (included here as a git submodule).

## Install

Clone and run the install script to symlink everything to `~/.claude/`:

```bash
git clone --recurse-submodules https://github.com/Saturate/claude.git
cd claude
./install.sh              # Interactive mode (prompts for existing files)
./install.sh --force      # Backup existing files and create symlinks
./install.sh --skip-existing   # Skip existing files
```

The install script initializes the skills submodule and auto-detects all skills (any directory under `skills/` with a `SKILL.md`).

## Observability Plugin

Uses hooks to log almost everything. It saves this to files, but can also send it all to Loki/Grafana for some cool insights.

1. Add this repo as a market place `/plugin marketplace add Saturate/claude`
2. Install the plugin `/plugin install observability@Saturate-claude`

You'll also need some enviroment variables:

```sh
# Inside .zshrc or similar, just needs to be available to the hooks
export LOKI_URL="https://loki.example.com/loki/api/v1/push"
# If loki needs auth
export LOKI_USER="loki-username"
export LOKI_PASS="password"
```
