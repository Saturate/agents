# GitHub PR Integration

Reference for: PR Review

How to extract PR information from GitHub URLs and use `gh` CLI to get branch details.

## Table of Contents

1. [URL Pattern Detection](#url-pattern-detection)
2. [Prerequisites](#prerequisites)
3. [Extracting PR Information](#extracting-pr-information)
4. [Checkout PR Branch](#checkout-pr-branch)
5. [Get PR Diff](#get-pr-diff)
6. [Get PR Files Changed](#get-pr-files-changed)
7. [Get PR Comments](#get-pr-comments)
8. [Complete Workflow](#complete-workflow)
9. [Error Handling](#error-handling)
10. [Tips](#tips)
11. [Comparison with git commands](#comparison-with-git-commands)

---

## URL Pattern Detection

GitHub PR URLs follow these patterns:

```
https://github.com/{owner}/{repo}/pull/{pr-number}
https://www.github.com/{owner}/{repo}/pull/{pr-number}
```

**Detection regex:**
```bash
# Match GitHub PR URLs
if [[ "$url" =~ github\.com/([^/]+)/([^/]+)/pull/([0-9]+) ]]; then
  owner="${BASH_REMATCH[1]}"
  repo="${BASH_REMATCH[2]}"
  pr_number="${BASH_REMATCH[3]}"
fi
```

## Prerequisites

**Check if gh CLI is installed:**
```bash
if ! command -v gh &> /dev/null; then
  echo "❌ GitHub CLI (gh) is not installed."
  echo "Install: https://cli.github.com/"
  exit 1
fi
```

**Check authentication:**
```bash
if ! gh auth status &> /dev/null; then
  echo "❌ Not authenticated with GitHub CLI."
  echo "Login: gh auth login"
  exit 1
fi
```

## Extracting PR Information

### Get PR Details

```bash
# Get PR information as JSON
pr_info=$(gh pr view $pr_number --repo $owner/$repo --json \
  title,body,state,headRefName,baseRefName,author,createdAt,number)
```

### Extract Branch Names

```bash
# Extract source (head) and target (base) branches
source_branch=$(echo "$pr_info" | jq -r '.headRefName')
target_branch=$(echo "$pr_info" | jq -r '.baseRefName')

echo "PR #$pr_number: $source_branch → $target_branch"
```

### Get PR Title and Description

```bash
title=$(echo "$pr_info" | jq -r '.title')
body=$(echo "$pr_info" | jq -r '.body')
author=$(echo "$pr_info" | jq -r '.author.login')

echo "Title: $title"
echo "Author: @$author"
```

### Check PR State

```bash
state=$(echo "$pr_info" | jq -r '.state')

case $state in
  "OPEN")
    echo "✅ PR is open"
    ;;
  "MERGED")
    echo "⚠️ PR is already merged"
    ;;
  "CLOSED")
    echo "❌ PR is closed"
    exit 1
    ;;
esac
```

## Checkout PR Branch

Once you have the branch name:

```bash
# Ensure we're in a git repository
if ! git rev-parse --git-dir &> /dev/null; then
  echo "❌ Not in a git repository"
  exit 1
fi

# Using gh CLI to checkout PR directly
echo "Checking out PR #$pr_number..."
gh pr checkout $pr_number --repo $owner/$repo
```

Alternative manual checkout:

```bash
# Fetch latest from remote
echo "Fetching latest changes..."
git fetch origin

# Check if branch exists locally
if git rev-parse --verify "$source_branch" &> /dev/null; then
  echo "Branch exists locally, checking out..."
  git checkout "$source_branch"
  git pull origin "$source_branch"
else
  echo "Branch doesn't exist locally, creating from remote..."
  git checkout -b "$source_branch" "origin/$source_branch"
fi
```

## Get PR Diff

```bash
# Get diff using gh CLI
gh pr diff $pr_number --repo $owner/$repo

# Or get specific file changes
gh pr diff $pr_number --repo $owner/$repo -- path/to/file.js
```

## Get PR Files Changed

```bash
# List files changed in PR
gh pr view $pr_number --repo $owner/$repo --json files --jq '.files[].path'
```

## Get PR Comments

```bash
# Get review comments
gh pr view $pr_number --repo $owner/$repo --comments

# Get specific review threads
gh api repos/$owner/$repo/pulls/$pr_number/comments
```

## Complete Workflow

```bash
# 1. Parse URL
url="https://github.com/facebook/react/pull/12345"

# 2. Extract components
if [[ "$url" =~ github\.com/([^/]+)/([^/]+)/pull/([0-9]+) ]]; then
  owner="${BASH_REMATCH[1]}"
  repo="${BASH_REMATCH[2]}"
  pr_number="${BASH_REMATCH[3]}"
else
  echo "❌ Invalid GitHub PR URL"
  exit 1
fi

# 3. Get PR details
pr_info=$(gh pr view $pr_number --repo $owner/$repo --json \
  title,headRefName,baseRefName,state,author)

source_branch=$(echo "$pr_info" | jq -r '.headRefName')
target_branch=$(echo "$pr_info" | jq -r '.baseRefName')
title=$(echo "$pr_info" | jq -r '.title')
state=$(echo "$pr_info" | jq -r '.state')

# 4. Verify PR is open
if [[ "$state" != "OPEN" ]]; then
  echo "⚠️ PR is $state"
fi

# 5. Display info
echo "📋 PR #$pr_number: $title"
echo "🔀 $source_branch → $target_branch"

# 6. Checkout PR
gh pr checkout $pr_number --repo $owner/$repo

# 7. Proceed with review...
```

## Error Handling

**gh CLI not installed:**
```
❌ GitHub CLI (gh) is not installed.

Install GitHub CLI:
- macOS: brew install gh
- Ubuntu/Debian:
  type -p curl >/dev/null || sudo apt install curl -y
  curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg
  sudo chmod go+r /usr/share/keyrings/githubcli-archive-keyring.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null
  sudo apt update
  sudo apt install gh -y
- Windows: winget install --id GitHub.cli

After installation:
gh auth login
```

**Not authenticated:**
```
❌ Not authenticated with GitHub CLI.

Login with:
gh auth login

Follow the prompts to:
1. Choose GitHub.com or GitHub Enterprise
2. Choose HTTPS or SSH
3. Authenticate with web browser or token
```

**PR not found:**
```
❌ PR #12345 not found in facebook/react.

Possible issues:
- Wrong PR number
- Repository is private and you don't have access
- PR URL is incorrect

Verify PR exists at: https://github.com/facebook/react/pull/12345
```

**Repository mismatch:**
```
⚠️ Current repository doesn't match PR repository.

PR is for: facebook/react
Current repo: facebook/react-native

Clone the correct repository first:
git clone git@github.com:facebook/react.git
cd react
```

**Fork PRs:**
If the PR is from a fork, `gh pr checkout` handles it automatically by adding the fork as a remote.

## Tips

**Quick PR checkout:**
If you're already in the correct repository:
```bash
gh pr checkout 12345
```

**View PR in browser:**
```bash
gh pr view 12345 --web
```

**Check PR status:**
```bash
gh pr status
```

**List PRs:**
```bash
# List all open PRs
gh pr list

# List your PRs
gh pr list --author @me
```

**Review PR:**
```bash
# Start a review
gh pr review 12345

# Approve PR
gh pr review 12345 --approve

# Request changes
gh pr review 12345 --request-changes --body "Please fix X"
```

**CI Status:**
```bash
# Check CI status
gh pr checks 12345
```

## Comparison with git commands

**Using gh CLI:**
```bash
gh pr checkout 12345  # One command, handles everything
```

**Equivalent git commands:**
```bash
git fetch origin pull/12345/head:pr-12345
git checkout pr-12345
```

The `gh` CLI approach is simpler and handles edge cases (forks, remote setup, etc.) automatically.
