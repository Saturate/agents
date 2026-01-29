---
name: azure-init
description: This skill should be used when the user asks to "initialize Azure DevOps project", "clone Azure repos", "setup Azure project locally", mentions "azure-init", or wants to download/clone all repositories from an Azure DevOps project.
version: 1.0.0
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

### 0. Check MCP Connection

**CRITICAL FIRST STEP**: Before proceeding, verify Azure DevOps MCP is available:

1. Try to call `mcp__azure-devops__core_list_projects` (with no parameters)
2. If the call succeeds: Continue to step 1
3. If the call fails with "Unknown tool" or similar error:
   - Inform user: "Azure DevOps MCP is not installed or connected"
   - Provide setup instructions (see MCP Setup section below)
   - Exit gracefully

### 1. Parse Arguments

Extract the project identifier and optional target directory from the args string:
- If only one argument: it's the project name/ID
- If two arguments: first is project name/ID, second is target directory

### 2. Find the Project

- Use `mcp__azure-devops__core_list_projects` to retrieve all projects
- Search for the project by name (case-insensitive partial match)
- If exact match not found, look for partial matches and ask user to clarify
- If still not found, list available projects matching the search term
- Extract the project ID for the next step

### 3. List Repositories

- Use `mcp__azure-devops__repo_list_repos_by_project` with the project ID
- Display the repositories found with their names and sizes
- If no repositories found, inform the user and exit

### 4. Determine Target Directory

- If target directory was provided in args, use it
- Otherwise, create path: `~/code/{sanitized-project-name}`
  - Sanitize by replacing spaces with hyphens and making lowercase
  - Example: "DCC Energi" → "~/code/dcc-energi"

### 5. Create Directory Structure

- Create the target directory if it doesn't exist
- Use `mkdir -p` to create parent directories as needed

### 6. Clone Repositories

For each repository:
- Build SSH URL: `git@ssh.dev.azure.com:v3/{organization}/{project-name}/{repo-name}`
  - Extract organization from the project URL (e.g., "norriq")
  - URL encode project name if it contains spaces (replace spaces with `%20`)
- Sanitize repository name for directory (replace spaces with hyphens)
- Check if directory already exists:
  - If exists, skip with message
  - If not exists, clone the repository
- Clone using: `git clone {ssh-url} "{target-dir}/{sanitized-repo-name}"`
- **Error handling for clone failures:**
  - If clone fails with "Permission denied (publickey)":
    - Inform user SSH keys are not configured
    - Provide SSH setup instructions (see SSH Setup section)
    - Continue with remaining repositories or exit based on user preference
  - If clone fails with other error:
    - Report the error
    - Ask if user wants to continue with remaining repos

**Important**: Clone repositories sequentially to avoid overwhelming the connection and to provide clear progress updates.

### 7. Verify and Report

- List the final directory structure using `ls -lh`
- Provide a summary including:
  - Number of repositories cloned successfully
  - Number of repositories skipped (already existed)
  - Number of repositories failed (if any)
  - Full path to the project directory
  - Next steps suggestion (e.g., "cd ~/code/dcc-energi/DCC-Api")

## Example Usage

```
/azure-init "DCC Energi"
→ Clones to ~/code/dcc-energi/

/azure-init "DCC Energi" ~/projects/dcc
→ Clones to ~/projects/dcc/

/azure-init 0d1e562b-95af-4c55-a8ce-8f26508d50ed
→ Uses project ID directly
```

## Error Handling

### MCP Not Available
If Azure DevOps MCP tools are not available:
```
❌ Azure DevOps MCP is not installed or connected.

To set up Azure DevOps MCP:
1. Run: /mcp
2. Follow the setup instructions to install the Azure DevOps MCP server
3. Once connected, try again with: /azure-init "project-name"

For more info: https://github.com/brynshanahan/azure-devops-mcp
```

### SSH Not Configured
If git clone fails with "Permission denied (publickey)":
```
❌ SSH authentication failed. You need to configure SSH keys for Azure DevOps.

To set up SSH keys:
1. Generate SSH key (if you don't have one):
   ssh-keygen -t rsa -b 4096 -C "your.email@example.com"

2. Copy your public key:
   cat ~/.ssh/id_rsa.pub

3. Add to Azure DevOps:
   - Go to: https://dev.azure.com/{org}/_usersSettings/keys
   - Click "New Key"
   - Paste your public key
   - Save

4. Test connection:
   ssh -T git@ssh.dev.azure.com

For more info: https://learn.microsoft.com/en-us/azure/devops/repos/git/use-ssh-keys-to-authenticate
```

### Other Common Errors

- **Project not found**: List available projects or suggest searching
- **No repositories**: Inform user the project has no repositories
- **Clone failures**: Report which repository failed and why
- **Directory permission issues**: Report and suggest using sudo or different directory
- **Network issues**: Suggest checking internet connection and Azure DevOps status

## Prerequisites

✅ **Required:**
- Azure DevOps MCP connection must be active
- SSH authentication must be configured for Azure DevOps
- Git must be installed and available

🔍 **Verification:**
- MCP: Checked automatically in step 0
- SSH: Checked during first clone attempt
- Git: Can check with `git --version`

## MCP Setup Reference

If user needs to set up Azure DevOps MCP, guide them through:

1. **Check if MCP exists:**
   ```bash
   ls ~/.config/claude/mcp.json
   ```

2. **Install Azure DevOps MCP:**
   ```bash
   # The specific installation method depends on the MCP server implementation
   # Common approach is adding to mcp.json configuration
   ```

3. **Connect to MCP:**
   ```bash
   /mcp  # In Claude Code
   ```

4. **Test connection:**
   ```bash
   # Try listing projects to verify
   ```

## Notes

- Repositories that already exist locally will be skipped (not re-cloned)
- Large repositories may take time to clone - progress is shown
- The skill extracts organization name from Azure DevOps URLs automatically
- URL encoding handles project names with spaces correctly
- All errors are handled gracefully with helpful guidance
