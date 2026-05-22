---
name: safe-delete
description: Safely handles recursive file/directory deletion by classifying targets, backing up what can't be recovered, and verifying nothing is lost before committing the delete. Use when running rm -rf, rm -r, deleting directories, removing files recursively, cleaning up paths, delete folder, remove directory, or clean up.
compatibility: Requires git for full classification. Falls back to tmp backup without git.
allowed-tools: Bash Read
metadata:
  author: Saturate
  version: "1.0"
---

# Safe Delete

## Progress Checklist

- [ ] Classify targets (regenerable / git-tracked clean / dirty or untracked)
- [ ] Back up anything that can't be recovered
- [ ] Verify backup exists
- [ ] Delete with SKILL_ACK prefix
- [ ] Verify nothing broke

## Step 0: Classify Every Target

First, check whether you're in a git repository:

```bash
git rev-parse --git-dir 2>/dev/null
```

**Not in a git repo?** Classify everything as either **Regenerable** or **Untracked** and skip git-specific checks below.

For each path being deleted, determine its category:

```bash
# Check if path exists
ls -la <path>

# Check size
du -sh <path>

# Git-only: check if tracked and dirty
git ls-files --error-unmatch <path> 2>/dev/null
git status --porcelain <path>
```

| Category | Examples | Backup needed? |
|----------|---------|---------------|
| **Regenerable** | `node_modules`, `dist`, `.next`, `target`, `bin`, `obj`, `__pycache__`, `.cache`, `build`, `.turbo`, `.parcel-cache`, `coverage` | No — skip to Step 3 |
| **Git-tracked, clean** | Any tracked file with no uncommitted changes | No — `git checkout` can restore |
| **Git-tracked, dirty** | Tracked file with uncommitted changes or staged work | **Yes** — changes not in history yet |
| **Untracked** | New files, generated configs, local data, anything outside a git repo | **Yes** — no recovery path |

If ALL targets are regenerable or git-tracked clean, skip to Step 3.

## Step 1: Back Up

Pick the strategy based on what you're protecting:

### Git-tracked files with uncommitted changes

Stash or branch — keeps it in git where it's easy to recover:

```bash
# Option A: stash (good for small changes)
git stash push -m "backup before delete: <path>" -- <path>

# Option B: backup branch (good for large or multi-file changes)
git checkout -b backup/before-delete-<timestamp>
git add <path>
git commit -m "backup: snapshot before deleting <path>"
git checkout -  # return to original branch
```

### Untracked files

Move to a timestamped temp directory:

```bash
BACKUP_DIR="/tmp/safe-delete-backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"
mv <path> "$BACKUP_DIR/"
echo "Backed up to: $BACKUP_DIR"
```

Tell the user where the backup lives.

### Both (dirty tracked + untracked in same directory)

Use both strategies — stash the tracked changes, move the untracked files.

## Step 2: Verify Backup

Don't trust the backup command succeeded — check:

```bash
# If stashed
git stash list | head -3

# If branched
git log backup/before-delete-<timestamp> --oneline -1

# If moved to tmp
ls -la "$BACKUP_DIR/"
```

If the backup isn't there, **stop** and tell the user.

## Step 3: Delete

Use the `SKILL_ACK=safe-delete` prefix so the advisor hook lets it through:

```bash
SKILL_ACK=safe-delete rm -rf <path>
```

## Step 4: Verify Nothing Broke

Quick sanity check after deletion:

```bash
# Check git status is clean (no unexpected changes)
git status --short

# If the project has a build step, run it
# npm run build / dotnet build / cargo build / etc.
```

If something broke, recover from backup:

```bash
# From stash
git stash pop

# From branch
git checkout backup/before-delete-<timestamp> -- <path>

# From tmp
cp -r "$BACKUP_DIR/<path>" <path>
```

## Anti-Patterns

- Don't delete without classifying first — you might lose untracked work
- Don't back up regenerable directories (node_modules, dist) — waste of time and disk
- Don't skip the verification step — "it should be fine" is how data gets lost
- Don't delete `.git` directories — that's destructive beyond recovery
