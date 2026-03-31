# Platform Detection Commands

## Azure DevOps

```bash
# List work items assigned to current user
az boards work-item list --query "[System.AssignedTo] = @me" --output table

# Get specific work item
az boards work-item show --id 1234

# List recent PRs
az repos pr list --status active --output table

# Get work item from branch name (AB#1234)
BRANCH=$(git branch --show-current)
WI_ID=$(echo "$BRANCH" | grep -oP 'AB#\K\d+')
az boards work-item show --id "$WI_ID" 2>/dev/null
```

If Azure DevOps MCP tools are available, prefer those over CLI:
- `wit_get_work_item` - get work item details
- `wit_my_work_items` - list assigned work items
- `repo_list_pull_requests_by_repo_or_project` - list PRs

## GitHub

```bash
# Get issue from branch name (#123 or issue-123)
BRANCH=$(git branch --show-current)
ISSUE=$(echo "$BRANCH" | grep -oP '\d+')
gh issue view "$ISSUE" 2>/dev/null

# List assigned issues
gh issue list --assignee @me

# List recent PRs
gh pr list

# Check for related PRs on this branch
gh pr list --head "$(git branch --show-current)"
```

## Gitea / Other

```bash
# Most Gitea instances support GitHub-compatible API
# Check if tea CLI is available
which tea 2>/dev/null

# Otherwise fall back to git-only context
git log --oneline -20
git log --all --oneline --grep="keyword"
```

## Branch Name Conventions

| Pattern | Platform | Extract |
|---------|----------|---------|
| `feature/AB#1234-description` | Azure DevOps | Work item 1234 |
| `feature/1234-description` | GitHub/Gitea | Issue 1234 |
| `fix/issue-42` | GitHub/Gitea | Issue 42 |
| `user/name/description` | Any | No work item link |
