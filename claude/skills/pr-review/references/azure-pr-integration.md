# Azure DevOps PR Integration

Reference for: PR Review

**Purpose:** Extract branch name from Azure DevOps PR URL and checkout the branch. That's it. Once the branch is checked out, the normal review process takes over.

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
# 1. Parse URL to get org, project, repo, PR number
# 2. Configure az devops with org and project
# 3. Get PR info to extract branch name
# 4. Checkout the branch
# 5. Return to main skill for review
```

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

## Get Branch Name from PR

**Step 1: Parse the URL**

```bash
url="https://dev.azure.com/norriq/Accelerator/_git/CommercePlatform.Frontend/pullrequest/33325"

if [[ "$url" =~ dev\.azure\.com/([^/]+)/([^/]+)/_git/([^/]+)/pullrequest/([0-9]+) ]]; then
  org="${BASH_REMATCH[1]}"
  project="${BASH_REMATCH[2]}"
  repo="${BASH_REMATCH[3]}"
  pr_number="${BASH_REMATCH[4]}"
else
  echo "❌ Invalid Azure DevOps PR URL"
  exit 1
fi
```

**Step 2: Get PR information including work items**

```bash
# Get branch name, title, description, and work items for context
pr_info=$(az repos pr show \
  --id $pr_number \
  --organization https://dev.azure.com/$org \
  --project "$project" \
  --query '{
    branch: sourceRefName,
    title: title,
    description: description,
    author: createdBy.displayName
  }' -o json)

source_branch=$(echo "$pr_info" | jq -r '.branch' | sed 's|refs/heads/||')
title=$(echo "$pr_info" | jq -r '.title')
description=$(echo "$pr_info" | jq -r '.description')
author=$(echo "$pr_info" | jq -r '.author')

# Get linked work items
work_items=$(az repos pr work-item list \
  --id $pr_number \
  --organization https://dev.azure.com/$org \
  --query '[].{id: id, title: title, type: workItemType}' -o json)

work_item_count=$(echo "$work_items" | jq 'length')

echo "📋 PR #$pr_number: $title"
echo "👤 Author: $author"
echo "🔀 Branch: $source_branch"
echo "🔗 Work Items: $work_item_count linked"

# Display work items if any
if [ "$work_item_count" -gt 0 ]; then
  echo "$work_items" | jq -r '.[] | "  - #\(.id) [\(.type)] \(.title)"'
fi
```

**Evaluating work items in review:**
- Bug fix PRs should link to Bug work items
- Feature PRs should link to User Story or Feature work items
- No work items = ask if one should be created/linked
- Wrong type = suggest appropriate work item type

**Important:** Don't use `az devops configure --defaults` with `--project` - it doesn't work. Always use `--organization` and `--project` as explicit parameters to each command.

## Checkout the Branch

```bash
# Fetch and checkout the branch
git fetch origin
git checkout -b "$source_branch" "origin/$source_branch" 2>/dev/null || git checkout "$source_branch"

echo "✅ Checked out $source_branch"
# Now return to main skill to perform the review
```

That's it. Don't fetch commits, diffs, or other PR details. Once the branch is checked out, git can provide all that information normally.

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

