---
name: azure-init
description: Initialize local dev environment from Azure DevOps by cloning all project repositories. Use when user asks to "initialize Azure project", "clone Azure repos", "setup Azure project locally", or wants to download all repositories from an Azure DevOps project.
compatibility: Requires Azure DevOps MCP connection and Git
allowed-tools: Bash
metadata:
  author: alkj
  version: "1.0.0"
---

# Azure DevOps Project Initialization

Initialize a local development environment from an Azure DevOps project by cloning all repositories.

## Overview

This skill helps users quickly set up a local development environment by:
- Finding an Azure DevOps project by name or ID
- Listing all repositories in that project
- Cloning all repositories to a local directory
- Organizing them in a clean folder structure

## Arguments

When invoked, parse the arguments as follows:
- **First argument** (required): Project name or ID
- **Second argument** (optional): Target directory path (defaults to `~/code/{sanitized-project-name}`)

## Instructions

Follow these steps when this skill is activated:

### 0. Verify Prerequisites

**CRITICAL FIRST STEP**: Before proceeding, verify required tools are available:

**Check Git:**
1. Run `git --version` to verify git is installed
2. If not found, inform user: "Git is not installed. Install it with your package manager (brew install git, apt install git, etc.)"
3. Exit if git is unavailable

**Check MCP Connection:**
1. Try to call `mcp__azure-devops__core_list_projects` (with no parameters)
2. If the call succeeds: Continue to step 1
3. If the call fails with "Unknown tool" or similar error:
   - Inform user: "Azure DevOps MCP is not installed or connected"
   - Provide setup instructions (see MCP Setup section below)
   - Exit gracefully

**Note:** The MCP tool names referenced here (`mcp__azure-devops__core_list_projects`, `mcp__azure-devops__repo_list_repos_by_project`) should match your actual Azure DevOps MCP server implementation. Verify these with your MCP server documentation.

### 1. Parse Arguments

Extract the project identifier and optional target directory from the args string:
- If only one argument: it's the project name/ID
- If two arguments: first is project name/ID, second is target directory

### 2. Find the Project

- Use `mcp__azure-devops__core_list_projects` to retrieve all projects
- Search for the project by name (case-insensitive partial match)
- If exact match not found, look for partial matches and ask user to clarify
- If still not found, list available projects matching the search term
- Extract from the project object:
  - **Project ID**: For listing repositories
  - **Project name**: For building git URLs
  - **Organization**: From the project's URL property or organization field (needed for SSH URLs)
  - Example: If project URL is `https://dev.azure.com/acmecorp/Platform%20Services`, organization is `acmecorp`

### 3. List Repositories

- Use `mcp__azure-devops__repo_list_repos_by_project` with the project ID
- Display the repositories found with their names and sizes
- If no repositories found, inform the user and exit

### 4. Determine Target Directory

**If target directory was provided in args:**
- Use it as-is

**If NOT provided, determine based on repository namespacing:**

**Check if repositories are properly namespaced:**
- A repo is "properly namespaced" if its name contains namespace separator (`.` or `-`) and has 2+ segments
- Examples of properly namespaced:
  - `Acme.Platform.Frontend` (3 segments with `.`)
  - `Contoso.DataHub` (2 segments with `.`)
  - `Fabrikam-Api` (2 segments with `-`)
- Examples of NOT namespaced:
  - `Frontend` (single word)
  - `Api` (single word)
  - `Infrastructure` (single word)

**Decision logic:**
1. Check first 3-5 repositories in the list
2. If ALL are properly namespaced → Place directly in `~/code/`
   - Each repo goes to: `~/code/{sanitized-repo-name}`
3. If ANY are NOT properly namespaced → Use project folder structure
   - Each repo goes to: `~/code/{sanitized-project-name}/{sanitized-repo-name}`

**Sanitization rules** (apply to all directory names):
- Replace spaces with hyphens
- Convert to lowercase (preserve dots and hyphens)
- Remove or replace special characters that aren't filesystem-safe
- Examples:
  - "Platform Services" → "platform-services"
  - "My Project!" → "my-project"
  - "Acme.Platform.Frontend" → "acme.platform.frontend"

### 5. Create Directory Structure

**Based on the namespacing decision from step 4:**

- If placing directly in `~/code/`: No parent directory needed
- If using project folder: Create `~/code/{sanitized-project-name}/`
- Use `mkdir -p` to create parent directories as needed

**Inform the user of the decision:**
```
Repository naming analysis:
✓ Repositories are properly namespaced (e.g., Acme.Platform.Api)
→ Placing directly in ~/code/

or

Repository naming analysis:
⚠ Repositories are not namespaced (e.g., Api, Frontend)
→ Organizing in project folder: ~/code/platform-services/
```

### 6. Clone Repositories

For each repository:

**Build SSH URL:** `git@ssh.dev.azure.com:v3/{organization}/{project-name}/{repo-name}`
- Use the original project and repo names from Azure DevOps
- URL encode both project name and repo name:
  - Spaces → `%20`
  - Special chars → URL encoded equivalents
  - Example: `git@ssh.dev.azure.com:v3/acmecorp/Platform%20Services/My%20Repo`

**Sanitize directory name:**
- Apply sanitization rules from step 4 to the repository name
- This is ONLY for the local directory name, not the git URL
- Example: "My Repo" → "my-repo" (for directory), but "My%20Repo" in URL

**Determine full clone path:**
- If repos are properly namespaced: `~/code/{sanitized-repo-name}`
- If repos are NOT namespaced: `~/code/{sanitized-project-name}/{sanitized-repo-name}`

**Check if directory already exists:**
- Check if the full clone path exists
- If exists and contains `.git` folder: skip with message "Already cloned"
- If exists but no `.git` folder: warn user and ask whether to remove and re-clone or skip
- If not exists: proceed with clone

**Clone the repository:**
- Run: `git clone {ssh-url} "{full-clone-path}"`
- Show progress for each clone

**Error handling for clone failures:**
- If clone fails with "Permission denied (publickey)":
  - Inform user SSH keys are not configured
  - Provide SSH setup instructions (see SSH Setup section)
  - Ask: "Continue with remaining repos? (y/n)"
  - If no: exit and suggest cleanup (see Cleanup on Failure section)
- If clone fails with other error:
  - Report the specific error message
  - Ask if user wants to continue with remaining repos
  - If no: exit and document what was cloned successfully

**Rate limiting:**
- Clone repositories sequentially (not in parallel)
- Consider adding 1-2 second delay between clones for large projects (10+ repos)
- This prevents overwhelming Azure DevOps and provides clear progress updates

### 7. Verify and Report

- List the final directory structure using `ls -lh` on the appropriate directory
- Provide a summary including:
  - Number of repositories cloned successfully
  - Number of repositories skipped (already existed)
  - Number of repositories failed (if any)
  - Full path to the location (either project folder or ~/code)
  - Next steps suggestion with path to a primary repository

### 8. Cleanup on Failure

If the process exits early (MCP issues, SSH failures, network errors), inform the user of the current state:

**Partial clone scenario (non-namespaced repos):**
```
⚠️  Clone process incomplete. Current state:
- Successfully cloned: 3 repositories
- Failed/Skipped: 5 repositories
- Location: ~/code/platform-services

Options:
1. Fix the issue (SSH keys, network) and run /azure-init again
   - Already cloned repos will be skipped automatically
2. Remove partial setup: rm -rf ~/code/platform-services
3. Continue manually: cd ~/code/platform-services and clone remaining repos
```

**Partial clone scenario (namespaced repos):**
```
⚠️  Clone process incomplete. Current state:
- Successfully cloned: 2 repositories
- Failed/Skipped: 3 repositories
- Location: ~/code (acme.platform.api, acme.platform.frontend)

Options:
1. Fix the issue (SSH keys, network) and run /azure-init again
   - Already cloned repos will be skipped automatically
2. Remove partial clones: rm -rf ~/code/acme.platform.*
3. Continue manually: clone remaining repos to ~/code
```

Always provide clear next steps so users know how to proceed or clean up.

## Optional Flags

When parsing arguments, support an optional `--dry-run` flag:

```bash
/azure-init "Platform Services" --dry-run
/azure-init "Platform Services" ~/projects/platform --dry-run
```

**Dry run behavior:**
- Perform all checks (git, MCP, find project)
- List all repositories that would be cloned
- Analyze repository namespacing and show the decision
- Show the target directory structure that would be created
- Calculate total size if available
- Do NOT actually clone any repositories
- Show exact git commands that would be executed

This lets users preview what will happen before committing to large clones.

## Example Usage

```bash
/azure-init "Platform Services"
# If repos are NOT namespaced (Api, Frontend, etc.):
#   → Clones to ~/code/platform-services/api, ~/code/platform-services/frontend, etc.
# If repos ARE namespaced (Acme.Platform.Api, Acme.Platform.Frontend, etc.):
#   → Clones to ~/code/acme.platform.api, ~/code/acme.platform.frontend, etc.

/azure-init "Platform Services" ~/projects/platform
# Clones to ~/projects/platform/ (overrides automatic directory decision)

/azure-init 0d1e562b-95af-4c55-a8ce-8f26508d50ed
# Uses project ID directly, applies same namespacing logic

/azure-init "Platform Services" --dry-run
# Preview what would be cloned without actually cloning
```

## Example Output

### Example 1: Non-namespaced repos (uses project folder)

```
✓ Git is installed (version 2.39.0)
✓ Azure DevOps MCP is connected

Finding project "Platform Services"...
✓ Found: Platform Services (ID: 0d1e562b-95af-4c55-a8ce-8f26508d50ed)

Listing repositories...
Found 4 repositories:
  - Api (125 MB)
  - Frontend (89 MB)
  - Infrastructure (12 MB)
  - Docs (5 MB)

Repository naming analysis:
⚠ Repositories are not namespaced (e.g., Api, Frontend)
→ Organizing in project folder: ~/code/platform-services/

Cloning repositories...
[1/4] Cloning Api...
✓ Cloned Api → ~/code/platform-services/api

[2/4] Cloning Frontend...
✓ Cloned Frontend → ~/code/platform-services/frontend

[3/4] Cloning Infrastructure...
⊘ Skipped Infrastructure (already exists)

[4/4] Cloning Docs...
✓ Cloned Docs → ~/code/platform-services/docs

Summary:
✓ Successfully cloned: 3 repositories
⊘ Skipped: 1 repository
✗ Failed: 0 repositories

Location: ~/code/platform-services

Next steps:
  cd ~/code/platform-services/api
```

### Example 2: Properly namespaced repos (directly in ~/code)

```
✓ Git is installed (version 2.39.0)
✓ Azure DevOps MCP is connected

Finding project "Acme Platform"...
✓ Found: Acme Platform (ID: a1b2c3d4-...)

Listing repositories...
Found 3 repositories:
  - Acme.Platform.Api (145 MB)
  - Acme.Platform.Frontend (210 MB)
  - Acme.Platform.Hosting (18 MB)

Repository naming analysis:
✓ Repositories are properly namespaced (e.g., Acme.Platform.Api)
→ Placing directly in ~/code/

Cloning repositories...
[1/3] Cloning Acme.Platform.Api...
✓ Cloned Acme.Platform.Api → ~/code/acme.platform.api

[2/3] Cloning Acme.Platform.Frontend...
✓ Cloned Acme.Platform.Frontend → ~/code/acme.platform.frontend

[3/3] Cloning Acme.Platform.Hosting...
✓ Cloned Acme.Platform.Hosting → ~/code/acme.platform.hosting

Summary:
✓ Successfully cloned: 3 repositories
⊘ Skipped: 0 repositories
✗ Failed: 0 repositories

Location: ~/code

Next steps:
  cd ~/code/acme.platform.api
```

## Error Handling

Handle common errors gracefully. For detailed error messages and setup instructions, see [references/troubleshooting.md](references/troubleshooting.md).

**Common error scenarios:**
- **MCP not available**: Guide user through MCP setup
- **SSH not configured**: Provide SSH key generation and setup instructions
- **Project not found**: List available projects or suggest search improvements
- **Clone failures**: Report which repository failed and why
- **Permission issues**: Suggest alternative directory or permission fixes

## Prerequisites

✅ **Required:**
- Git must be installed and available
- Azure DevOps MCP connection must be active
- SSH authentication must be configured for Azure DevOps

🔍 **Automatic verification** happens in step 0 - See [references/troubleshooting.md](references/troubleshooting.md) for detailed setup instructions

## Notes

**Namespacing logic:**
- The skill automatically detects if repositories are properly namespaced
- **Properly namespaced** = Contains `.` or `-` separator with 2+ segments (e.g., `Acme.Platform.Api`, `Contoso-DataHub`)
- Namespaced repos go directly to `~/code/{repo-name}` (flat structure)
- Non-namespaced repos go to `~/code/{project-name}/{repo-name}` (nested structure)
- This keeps your ~/code folder organized and consistent with established patterns

**General behavior:**
- Repositories that already exist (with `.git` folder) will be skipped (not re-cloned)
- Re-running the skill after failures will skip already cloned repos automatically
- Large repositories may take time to clone - progress is shown for each repo
- The skill extracts organization name from Azure DevOps project objects automatically
- URL encoding handles both project and repository names with spaces correctly
- Directory names are sanitized (lowercase, spaces→hyphens, preserve dots) for filesystem compatibility
- Rate limiting prevents overwhelming Azure DevOps with parallel clone requests
- All errors are handled gracefully with helpful guidance and recovery options
- Default branch is determined by the repository's Azure DevOps settings
- You can override the automatic directory decision by providing a custom target directory
