# Claude Configuration

Symlinks `CLAUDE.md`, `settings.json`, `statusline-command.sh`, and custom skills to `~/.claude/`

**Skills:**
- `/review` - Code reviews for PRs and changes
- `/audit` - Comprehensive codebase audits

## Usage

```bash
./install.sh              # Interactive mode (prompts for existing files)
./install.sh --force      # Backup existing files and create symlinks
./install.sh --skip-existing   # Skip existing files
```
