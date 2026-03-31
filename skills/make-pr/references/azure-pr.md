# Azure DevOps CLI (`az`) Reference for Pull Requests

## Installation

### Azure CLI

#### macOS
```bash
brew install azure-cli
```

#### Linux
```bash
curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash
```

#### Windows
```powershell
winget install -e --id Microsoft.AzureCLI
```

Or download from: https://docs.microsoft.com/en-us/cli/azure/install-azure-cli

### Azure DevOps Extension

After installing Azure CLI, add the DevOps extension:
```bash
az extension add --name azure-devops
```

Update the extension:
```bash
az extension update --name azure-devops
```

## Authentication

### Login to Azure
```bash
az login
```

This opens a browser for authentication.

### Non-interactive login (with service principal)
```bash
az login --service-principal -u <app-id> -p <password-or-cert> --tenant <tenant-id>
```

### Personal Access Token (PAT)
For CI/CD or non-interactive scenarios:
```bash
export AZURE_DEVOPS_EXT_PAT=<your-pat-token>
az devops login
```

Or set as environment variable permanently in your shell config (.bashrc, .zshrc):
```bash
echo "export AZURE_DEVOPS_EXT_PAT=your-token-here" >> ~/.bashrc
```

### Configure defaults
Set default organization and project to avoid specifying them every time:
```bash
az devops configure --defaults organization=https://dev.azure.com/yourorg project=YourProject
```

### Check configuration
```bash
az devops configure --list
az account show
```

## Key Flags Reference

### `az repos pr create`

| Flag | Description | Example |
|------|-------------|---------|
| `--title` | PR title (required) | `--title "Add user auth"` |
| `--description` / `-d` | PR description | `--description "Implements OAuth2"` |
| `--source-branch` / `-s` | Source branch (default: current) | `--source-branch feature/auth` |
| `--target-branch` / `-t` | Target branch (default: default branch) | `--target-branch main` |
| `--draft` | Create as draft PR | `--draft true` |
| `--required-reviewers` | Required reviewers (space separated) | `--required-reviewers "alice@org.com bob@org.com"` |
| `--optional-reviewers` | Optional reviewers | `--optional-reviewers "carol@org.com"` |
| `--work-items` | Link work items (space separated IDs) | `--work-items "123 456"` |
| `--auto-complete` | Enable auto-complete when policies pass | `--auto-complete true` |
| `--squash` | Squash commits on merge | `--squash true` |
| `--delete-source-branch` | Delete source branch after merge | `--delete-source-branch true` |
| `--merge-commit-message` | Custom merge commit message | `--merge-commit-message "Merged PR 123"` |
| `--repository` / `-r` | Repository name | `--repository MyRepo` |
| `--project` / `-p` | Project name (or use default) | `--project MyProject` |
| `--organization` / `--org` | Organization URL | `--org https://dev.azure.com/myorg` |

### Reviewer formats
- Email: `alice@company.com`
- Object ID: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`
- Multiple reviewers: Space-separated list

### Branch reference formats
- Short: `main`, `feature/auth`
- Full: `refs/heads/main`, `refs/heads/feature/auth`

Both formats work, but Azure DevOps often returns full refs.

## Examples

### Basic PR
```bash
az repos pr create \
  --title "Add user authentication" \
  --description "Implements OAuth2 login flow"
```

### Draft PR with reviewers and work items
```bash
az repos pr create \
  --title "WIP: Payment integration" \
  --description "Still testing Stripe webhooks" \
  --draft true \
  --required-reviewers "alice@company.com" \
  --optional-reviewers "bob@company.com" \
  --work-items "1234 5678"
```

### PR to specific branch
```bash
az repos pr create \
  --title "Hotfix: Fix login redirect" \
  --description "Resolves issue with OAuth callback" \
  --source-branch hotfix/login-fix \
  --target-branch develop
```

### PR with auto-complete
```bash
az repos pr create \
  --title "Add error logging" \
  --description "Implements centralized error handling" \
  --auto-complete true \
  --squash true \
  --delete-source-branch true \
  --required-reviewers "team@company.com"
```

### Multi-line description
```bash
az repos pr create \
  --title "Refactor authentication" \
  --description "Moved auth logic to separate service" \
  --description "" \
  --description "This makes testing easier and reduces coupling" \
  --description "" \
  --description "## Changes" \
  --description "- Extracted AuthService" \
  --description "- Updated tests"
```

Each `--description` flag adds a new line.

### View existing PRs
```bash
# List all PRs
az repos pr list

# List PRs for specific branch
az repos pr list --source-branch feature/auth

# View specific PR
az repos pr show --id 42

# Open PR in browser
az repos pr show --id 42 --open
```

## Troubleshooting

### Not authenticated
**Error:** `Please run 'az login' to setup account.`

**Solution:**
```bash
az login
```

### No organization configured
**Error:** `--organization is required if not configured as a default`

**Solution:**
```bash
# Set default organization
az devops configure --defaults organization=https://dev.azure.com/yourorg

# Or specify on each command
az repos pr create --org https://dev.azure.com/yourorg ...
```

### No project configured
**Error:** `--project is required if not configured as a default`

**Solution:**
```bash
# Set default project
az devops configure --defaults project=YourProject

# Or specify on each command
az repos pr create --project YourProject ...
```

### Source branch doesn't exist on remote
**Error:** `TF401019: The Git repository with name or identifier ... does not exist or you do not have permissions`

**Solution:**
Push the branch first:
```bash
git push -u origin $(git branch --show-current)
```

### PR already exists
**Error:** `TF401179: An active pull request for the source and target branch already exists`

**Solution:**
```bash
# List PRs for current branch
current_branch=$(git branch --show-current)
az repos pr list --source-branch "$current_branch"

# Show the PR
az repos pr show --id <pr-id>
```

### Repository not found
**Error:** `fatal: repository ... not found`

**Solution:**
- Repository names are case-sensitive
- List repositories to find exact name:
  ```bash
  az repos list --output table
  ```
- Specify repository explicitly:
  ```bash
  az repos pr create --repository CorrectRepoName ...
  ```

### Permission denied
**Error:** `TF401027: You need the Git 'GenericContribute' permission to perform this action`

**Solution:**
- Ensure you have Contribute permission on the repository
- Contact project admin to grant access
- Verify PAT token has "Code (Read & Write)" scope

### Invalid work item
**Error:** `VS403496: Work item ... does not exist, or you do not have permissions to read it`

**Solution:**
- Verify work item ID exists
- Ensure work item is in the same project
- Check permissions on the work item

## Tips

### Work items integration
Link work items to automatically track which code changes implement which features:
```bash
az repos pr create --title "Add search" --work-items "1234 5678"
```

Work items will show "Development" links to the PR.

### Required vs optional reviewers
- **Required reviewers** must approve before merge
- **Optional reviewers** are notified but approval isn't required

```bash
az repos pr create \
  --required-reviewers "tech-lead@company.com" \
  --optional-reviewers "team-member@company.com"
```

### Auto-complete for automated workflows
Enable auto-complete to automatically merge when policies pass (all required reviewers approve, builds pass, etc.):
```bash
az repos pr create \
  --auto-complete true \
  --squash true \
  --delete-source-branch true
```

This is great for automated PRs (e.g., dependency updates).

### Branch refs: short vs full
Azure DevOps often returns full refs like `refs/heads/main`. You can use either format:
```bash
# Short format (recommended)
--target-branch main

# Full format (also works)
--target-branch refs/heads/main
```

The CLI handles both.

### Multi-line descriptions
Use multiple `--description` flags to create multi-line descriptions:
```bash
az repos pr create \
  --title "My PR" \
  --description "First line" \
  --description "Second line" \
  --description "" \
  --description "Fourth line (third was blank)"
```

Or use shell heredoc:
```bash
az repos pr create \
  --title "My PR" \
  --description "$(cat <<EOF
First line

Second paragraph

## Changes
- Change 1
- Change 2
EOF
)"
```

### Policy bypass (use sparingly)
In emergencies, you can complete a PR bypassing policies (requires permission):
```bash
az repos pr update --id <pr-id> --status completed --bypass-policy true
```

**Warning:** Only use in genuine emergencies. Bypassing policies defeats the purpose of having them.

### Set completion options after creation
```bash
# Update PR to auto-complete
az repos pr update --id 42 --auto-complete true

# Set merge strategy
az repos pr update --id 42 --squash true

# Mark as draft or ready
az repos pr update --id 42 --draft true
az repos pr update --id 42 --draft false
```

### Add reviewers after creation
```bash
# Add required reviewer
az repos pr reviewer add --id 42 --reviewers "alice@company.com" --required

# Add optional reviewer
az repos pr reviewer add --id 42 --reviewers "bob@company.com"
```

### Check PR status
```bash
# View PR details
az repos pr show --id 42

# View PR in browser
az repos pr show --id 42 --open

# List PR policies (build status, required reviewers, etc.)
az repos pr policy list --id 42
```

### Environment variables
Set these to avoid repeated authentication:
```bash
export AZURE_DEVOPS_EXT_PAT=your-token
export AZURE_DEVOPS_ORG=https://dev.azure.com/yourorg
export AZURE_DEVOPS_PROJECT=YourProject
```

Add to your shell config (.bashrc, .zshrc) for persistence.
