# GitHub CLI (`gh`) Reference for Pull Requests

## Installation

### macOS
```bash
brew install gh
```

### Linux (Debian/Ubuntu)
```bash
curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null
sudo apt update
sudo apt install gh
```

### Linux (Fedora/RHEL)
```bash
sudo dnf install gh
```

### Windows
```powershell
winget install --id GitHub.cli
```

Or download from: https://cli.github.com/

## Authentication

### Initial login
```bash
gh auth login
```

Follow the interactive prompts to authenticate via browser or token.

### Check auth status
```bash
gh auth status
```

### Refresh authentication
```bash
gh auth refresh
```

### Login with token (non-interactive)
```bash
gh auth login --with-token < token.txt
```

## Key Flags Reference

### `gh pr create`

| Flag | Description | Example |
|------|-------------|---------|
| `--title` / `-t` | PR title | `--title "Add user auth"` |
| `--body` / `-b` | PR description | `--body "Implements OAuth2"` |
| `--fill` | Auto-fill title/body from commits | `--fill` |
| `--draft` / `-d` | Create as draft PR | `--draft` |
| `--base` / `-B` | Target branch | `--base main` |
| `--head` / `-H` | Source branch (default: current) | `--head feature-branch` |
| `--reviewer` / `-r` | Reviewers (comma or space separated) | `--reviewer alice,bob` |
| `--assignee` / `-a` | Assignees | `--assignee @me` |
| `--label` / `-l` | Labels | `--label bug,urgent` |
| `--project` / `-p` | Project board | `--project "Sprint 2"` |
| `--milestone` / `-m` | Milestone | `--milestone v1.0` |
| `--web` / `-w` | Open PR in browser after creation | `--web` |

### Reviewer formats
- GitHub username: `alice`
- Multiple users: `alice,bob` or `alice bob`
- Team: `@org/team-name`
- Current user: `@me`

## Examples

### Basic PR with auto-fill
```bash
gh pr create --fill
```
Uses commit messages to populate title and description.

### Draft PR with reviewers
```bash
gh pr create --draft --title "WIP: Add payment flow" \
  --body "Still testing Stripe integration" \
  --reviewer alice,@org/backend-team
```

### PR to specific branch
```bash
gh pr create --base develop --title "Hotfix: Fix login bug" \
  --body "Resolves issue with OAuth redirect"
```

### PR with labels and auto-open in browser
```bash
gh pr create --fill --label bug,high-priority --web
```

### PR with issue linking
```bash
gh pr create --title "Fix user registration" \
  --body "Fixes #123

Fixed the validation logic that was preventing new users from registering."
```

### View existing PRs
```bash
# List all PRs
gh pr list

# List PRs for current branch
gh pr list --head $(git branch --show-current)

# View specific PR
gh pr view 42

# View PR in browser
gh pr view 42 --web
```

## Troubleshooting

### Not logged in
**Error:** `To get started with GitHub CLI, please run: gh auth login`

**Solution:**
```bash
gh auth login
```

### Remote not set
**Error:** `could not determine remote for repository`

**Solution:**
```bash
# Add GitHub remote
git remote add origin https://github.com/username/repo.git

# Or set upstream
git branch --set-upstream-to=origin/main
```

### PR already exists
**Error:** `a pull request for branch "feature" into branch "main" already exists`

**Solution:**
```bash
# List existing PRs for current branch
gh pr list --head $(git branch --show-current)

# View the existing PR
gh pr view
```

### Branch not pushed
**Error:** `HEAD must be a branch`

**Solution:**
```bash
# Push current branch to remote
git push -u origin $(git branch --show-current)
```

### Unmerged commits or conflicts
**Error:** `pull request create failed: GraphQL: Head sha can't be blank, Base sha can't be blank...`

**Solution:**
Resolve merge conflicts first:
```bash
git fetch origin
git merge origin/main
# Resolve conflicts
git push
```

### Rate limiting
**Error:** `API rate limit exceeded`

**Solution:**
```bash
# Check rate limit status
gh api rate_limit

# Wait for reset or authenticate (authenticated requests have higher limits)
gh auth login
```

### Permission denied
**Error:** `Resource not accessible by integration`

**Solution:**
- Ensure you have write access to the repository
- Check if repository requires specific permissions
- Re-authenticate: `gh auth refresh -s repo`

### Invalid reviewer
**Error:** `Could not resolve to a User with the login of 'username'`

**Solution:**
- Verify username spelling
- Ensure user has repository access
- For teams, use `@org/team-name` format

## Tips

### Auto-fill is smart
The `--fill` flag analyzes your commits and generates a good title and description automatically. It's great for quick PRs.

### Teams as reviewers
Use `@org/team-name` to request review from entire teams:
```bash
gh pr create --fill --reviewer @myorg/backend-team
```

### Draft PRs for WIP
Create draft PRs to get early feedback without marking it ready for review:
```bash
gh pr create --draft --fill
```

You can mark it ready later:
```bash
gh pr ready
```

### Link issues automatically
Include "Fixes #123" or "Closes #456" in your PR description to auto-close issues when merged:
```bash
gh pr create --title "Fix login bug" \
  --body "Fixes #123

The OAuth redirect URL was incorrectly configured."
```

### Edit PR after creation
```bash
# Edit title/description
gh pr edit

# Add reviewers
gh pr edit --add-reviewer alice,bob

# Add labels
gh pr edit --add-label bug,urgent

# Convert to draft
gh pr ready --undo
```

### Template files
GitHub looks for `.github/pull_request_template.md` to pre-fill descriptions. If this file exists, `--fill` will append to it.

### Check status
```bash
# View PR checks/CI status
gh pr checks

# View PR diff
gh pr diff

# View PR in browser
gh pr view --web
```
