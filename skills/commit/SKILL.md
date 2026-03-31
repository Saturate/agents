---
name: commit
description: Commits staged changes using Conventional Commits with auto-detected scope, work item linking, and secret scanning. Detects project conventions from commit history and config. Use when committing, making a commit, git commit, save changes, commit changes, commit my work, or when triggered by incremental-implementation after a verified slice.
allowed-tools: Bash Read Grep Glob
metadata:
  author: Saturate
  version: "1.0"
---

# Commit

## Progress Checklist

- [ ] Read the diff (staged changes only)
- [ ] Detect project commit conventions
- [ ] Auto-detect scope from changed files
- [ ] Scan diff for secrets
- [ ] Link work items if detectable
- [ ] Write message and commit

## Step 0: Detect Project Conventions

Check for existing conventions before assuming Conventional Commits:

```bash
# Check for commitlint config
ls .commitlintrc* commitlint.config.* 2>/dev/null

# Check recent commit history for patterns
git log --oneline -20
```

- If commitlint or similar config exists, follow that format
- If history shows Conventional Commits (`feat:`, `fix:`, etc.), use that
- If history shows a different pattern, match it
- Default: Conventional Commits (`type(scope): description`)

## Step 1: Read the Diff

Only look at what's actually being committed. Not the conversation, not the session history.

```bash
git diff --cached --stat    # Overview of changes
git diff --cached           # Full diff
```

If nothing is staged, check `git status` and suggest what to stage.

## Step 2: Auto-Detect Scope

Determine scope from the changed files:

- If all changes are in one directory/component, use that as scope: `feat(auth): ...`
- If changes span multiple areas, use the primary area or omit scope: `feat: ...`
- Common scopes: component name, package name, service name, directory name

## Step 3: Secret Scanning

Before committing, scan the diff for secrets:

```bash
git diff --cached | grep -iE '(api[_-]?key|secret|password|token|credential|private[_-]?key)\s*[:=]' || true
git diff --cached | grep -iE '(AKIA|sk-|ghp_|gho_|glpat-|xox[bsp]-)[A-Za-z0-9]' || true
```

If anything looks like a real secret (not a placeholder or test value):
1. **Stop** - do not commit
2. Flag the finding to the user
3. Suggest removing and adding to `.gitignore` / `.env`

## Step 4: Work Item Linking

Detect work items from branch name or context:

| Platform | Pattern | Commit format |
|----------|---------|--------------|
| Azure DevOps | `feature/AB#1234-description` | Include `AB#1234` in message |
| GitHub | `feature/123-description` or `issue-123` | Include `#123` in message |
| Gitea | Same as GitHub | Include `#123` in message |

```bash
# Get current branch
git branch --show-current

# Check git remote for platform
git remote get-url origin
```

Only link if confidently detected. Don't guess.

## Step 5: Write the Message

Style:
- Casual, like a humble but experienced engineer
- Explain **why**, not what (the diff shows what)
- Highlight non-obvious implementation choices
- Assume the reader can follow the code
- Keep the subject line under 72 characters

Format:
```
type(scope): concise description

Optional body explaining why this change was made and any
non-obvious decisions. Reference work items if detected.
```

Common types: `feat`, `fix`, `refactor`, `chore`, `docs`, `test`, `perf`, `ci`

## Step 6: Confirm and Commit

Show the user the proposed commit message. Wait for approval or edits. Then:

```bash
git commit -m "$(cat <<'EOF'
the commit message here
EOF
)"
```

## Anti-Patterns

- Don't summarize the conversation as the commit message
- Don't write essays - a sentence or two is fine
- Don't commit unrelated changes together
- Don't skip the secret scan
- Don't use generic messages ("update code", "fix stuff", "changes")
