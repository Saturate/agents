# Azure DevOps PR Integration

Reference for: PR Review

How to extract PR information from Azure DevOps URLs and use `az` CLI to get branch details.

## Table of Contents

1. [URL Pattern Detection](#url-pattern-detection)
2. [Prerequisites](#prerequisites)
3. [Extracting PR Information](#extracting-pr-information)
4. [Checkout PR Branch](#checkout-pr-branch)
5. [Get PR Diff](#get-pr-diff)
6. [Complete Workflow](#complete-workflow)
7. [Error Handling](#error-handling)
8. [Tips](#tips)

---

## URL Pattern Detection

Azure DevOps PR URLs follow these patterns:

```
https://dev.azure.com/{org}/{project}/_git/{repo}/pullrequest/{pr-number}
https://{org}.visualstudio.com/{project}/_git/{repo}/pullrequest/{pr-number}
```

**Detection regex:**
```bash
# Match Azure DevOps PR URLs
if [[ "$url" =~ dev\.azure\.com/([^/]+)/([^/]+)/_git/([^/]+)/pullrequest/([0-9]+) ]]; then
  org="${BASH_REMATCH[1]}"
  project="${BASH_REMATCH[2]}"
  repo="${BASH_REMATCH[3]}"
  pr_number="${BASH_REMATCH[4]}"
fi
```

## Prerequisites

**Check if az CLI is installed:**
```bash
if ! command -v az &> /dev/null; then
  echo "❌ Azure CLI (az) is not installed."
  echo "Install: https://learn.microsoft.com/en-us/cli/azure/install-azure-cli"
  exit 1
fi
```

**Check if azure-devops extension is installed:**
```bash
if ! az extension list --query "[?name=='azure-devops'].name" -o tsv | grep -q azure-devops; then
  echo "❌ Azure DevOps extension not installed."
  echo "Install: az extension add --name azure-devops"
  exit 1
fi
```

**Check authentication:**
```bash
if ! az account show &> /dev/null; then
  echo "❌ Not authenticated with Azure CLI."
  echo "Login: az login"
  exit 1
fi
```

## Extracting PR Information

### Get PR Details

```bash
# Set defaults for az devops commands
az devops configure --defaults organization=https://dev.azure.com/$org project=$project

# Get PR information as JSON
pr_info=$(az repos pr show --id $pr_number --query '{
  title: title,
  description: description,
  status: status,
  sourceRefName: sourceRefName,
  targetRefName: targetRefName,
  createdBy: createdBy.displayName,
  creationDate: creationDate,
  repository: repository.name
}' -o json)
```

### Extract Branch Names

```bash
# Extract source and target branches
source_branch=$(echo "$pr_info" | jq -r '.sourceRefName' | sed 's|refs/heads/||')
target_branch=$(echo "$pr_info" | jq -r '.targetRefName' | sed 's|refs/heads/||')

echo "PR #$pr_number: $source_branch → $target_branch"
```

### Get PR Title and Description

```bash
title=$(echo "$pr_info" | jq -r '.title')
description=$(echo "$pr_info" | jq -r '.description')
author=$(echo "$pr_info" | jq -r '.createdBy')

echo "Title: $title"
echo "Author: $author"
```

### Check PR Status

```bash
status=$(echo "$pr_info" | jq -r '.status')

case $status in
  "active")
    echo "✅ PR is active and open"
    ;;
  "completed")
    echo "⚠️ PR is already completed/merged"
    ;;
  "abandoned")
    echo "❌ PR is abandoned"
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
# Get files changed in PR
az repos pr show --id $pr_number --query 'lastMergeSourceCommit.commitId' -o tsv > /tmp/source_commit
az repos pr show --id $pr_number --query 'lastMergeTargetCommit.commitId' -o tsv > /tmp/target_commit

source_commit=$(cat /tmp/source_commit)
target_commit=$(cat /tmp/target_commit)

# Get diff using git
git diff $target_commit..$source_commit
```

## Complete Workflow

```bash
# 1. Parse URL
url="https://dev.azure.com/norriq/Accelerator/_git/CommercePlatform.Frontend/pullrequest/33325"

# 2. Extract components
if [[ "$url" =~ dev\.azure\.com/([^/]+)/([^/]+)/_git/([^/]+)/pullrequest/([0-9]+) ]]; then
  org="${BASH_REMATCH[1]}"
  project="${BASH_REMATCH[2]}"
  repo="${BASH_REMATCH[3]}"
  pr_number="${BASH_REMATCH[4]}"
else
  echo "❌ Invalid Azure DevOps PR URL"
  exit 1
fi

# 3. Configure az devops
az devops configure --defaults organization=https://dev.azure.com/$org project=$project

# 4. Get PR details
pr_info=$(az repos pr show --id $pr_number -o json)
source_branch=$(echo "$pr_info" | jq -r '.sourceRefName' | sed 's|refs/heads/||')
target_branch=$(echo "$pr_info" | jq -r '.targetRefName' | sed 's|refs/heads/||')
title=$(echo "$pr_info" | jq -r '.title')

# 5. Display info
echo "📋 PR #$pr_number: $title"
echo "🔀 $source_branch → $target_branch"

# 6. Checkout branch
git fetch origin
git checkout -b "$source_branch" "origin/$source_branch" 2>/dev/null || git checkout "$source_branch"

# 7. Proceed with review...
```

## Error Handling

**az CLI not installed:**
```
❌ Azure CLI (az) is not installed.

Install Azure CLI:
- macOS: brew install azure-cli
- Ubuntu/Debian: curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash
- Windows: Download from https://learn.microsoft.com/en-us/cli/azure/install-azure-cli

After installation, add azure-devops extension:
az extension add --name azure-devops
```

**Not authenticated:**
```
❌ Not authenticated with Azure CLI.

Login with:
az login

For service principal authentication:
az login --service-principal -u <app-id> -p <password> --tenant <tenant>
```

**PR not found:**
```
❌ PR #33325 not found in project Accelerator.

Possible issues:
- Wrong PR number
- No access to the project
- PR is in a different project

Verify PR URL and your access permissions.
```

**Repository mismatch:**
```
⚠️ Current repository doesn't match PR repository.

PR is for: CommercePlatform.Frontend
Current repo: CommercePlatform.Backend

Clone the correct repository first:
git clone git@ssh.dev.azure.com:v3/{org}/{project}/CommercePlatform.Frontend
```

## Tips

**Caching organization/project:**
If reviewing multiple PRs from the same project, set defaults once:
```bash
az devops configure --defaults organization=https://dev.azure.com/norriq project=Accelerator
```

**URL encoding:**
Azure DevOps project names with spaces are URL-encoded in URLs. The `az` CLI handles this automatically.

**Permissions:**
You need at least "Read" permissions on the repository to view PR details.
