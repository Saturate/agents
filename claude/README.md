# Claude Configuration

Personal Claude Code configuration — coding guidelines, settings, hooks, and statusline.

Skills live in a dedicated repo: **[Saturate/skills](https://github.com/Saturate/skills)** (included here as a git submodule).

## What's here

| File | Purpose |
|------|---------|
| `CLAUDE.md` | Coding guidelines, commit style, TypeScript rules, PR review policy |
| `settings.json` | Permission rules and tool settings |
| `statusline-command.sh` | Custom statusline script |
| `hooks/` | Tool-usage logging hooks |
| `skills/` | Git submodule pointing to [Saturate/skills](https://github.com/Saturate/skills) |

## Install

Clone and run the install script to symlink everything to `~/.claude/`:

```bash
git clone --recurse-submodules https://github.com/Saturate/claude.git
cd claude
./install.sh              # Interactive mode (prompts for existing files)
./install.sh --force      # Backup existing files and create symlinks
./install.sh --skip-existing   # Skip existing files
./install.sh --hooks      # Also symlink hooks/ for tool-usage logging
```

The install script initializes the skills submodule and auto-detects all skills (any directory under `skills/` with a `SKILL.md`).
