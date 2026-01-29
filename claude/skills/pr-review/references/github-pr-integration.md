# GitHub PR Integration

Reference for: PR Review

**Purpose:** Extract branch name from GitHub PR URL and checkout the branch. That's it. Once the branch is checked out, the normal review process takes over.

## Table of Contents

1. [Quick Workflow](#quick-workflow)
2. [URL Pattern Detection](#url-pattern-detection)
3. [Prerequisites](#prerequisites)
4. [Get Branch Name from PR](#get-branch-name-from-pr)
5. [Checkout the Branch](#checkout-the-branch)
6. [Error Handling](#error-handling)

---

## Quick Workflow

**Goal:** Checkout the PR branch so it can be reviewed. Don't fetch diffs or commits - git will handle that.

```bash
# 1. Parse URL to get owner, repo, PR number
# 2. Get PR info to extract branch name, title, description
# 3. Checkout the branch using gh pr checkout
# 4. Return to main skill for review
```

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

## Get Branch Name from PR

**Step 1: Parse the URL**

```bash
url="https://github.com/facebook/react/pull/12345"

if [[ "$url" =~ github\.com/([^/]+)/([^/]+)/pull/([0-9]+) ]]; then
  owner="${BASH_REMATCH[1]}"
  repo="${BASH_REMATCH[2]}"
  pr_number="${BASH_REMATCH[3]}"
else
  echo "❌ Invalid GitHub PR URL"
  exit 1
fi
```

**Step 2: Get PR information**

```bash
# Get branch name, title, and description for context
pr_info=$(gh pr view $pr_number --repo $owner/$repo --json \
  title,body,headRefName,author)

source_branch=$(echo "$pr_info" | jq -r '.headRefName')
title=$(echo "$pr_info" | jq -r '.title')
body=$(echo "$pr_info" | jq -r '.body')
author=$(echo "$pr_info" | jq -r '.author.login')

echo "📋 PR #$pr_number: $title"
echo "👤 Author: @$author"
echo "🔀 Branch: $source_branch"
```

## Checkout the Branch

```bash
# Use gh CLI to checkout - it handles forks automatically
gh pr checkout $pr_number --repo $owner/$repo

echo "✅ Checked out $source_branch"
# Now return to main skill to perform the review
```

That's it. Don't fetch commits, diffs, or other PR details. Once the branch is checked out, git can provide all that information normally.

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

