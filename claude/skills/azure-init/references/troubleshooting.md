# Troubleshooting Guide

Reference for: Azure DevOps Project Initialization

Common errors and their resolutions when initializing Azure DevOps projects.

## Table of Contents

1. [MCP Not Available](#mcp-not-available)
2. [SSH Not Configured](#ssh-not-configured)
3. [Other Common Errors](#other-common-errors)
4. [MCP Setup Reference](#mcp-setup-reference)

---

## MCP Not Available

If Azure DevOps MCP tools are not available:

```
❌ Azure DevOps MCP is not installed or connected.

To set up Azure DevOps MCP:
1. Run: /mcp
2. Follow the setup instructions to install the Azure DevOps MCP server
3. Once connected, try again with: /azure-init "project-name"

For more info: https://github.com/brynshanahan/azure-devops-mcp
```

## SSH Not Configured

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

## Other Common Errors

**Project not found:**
- List available projects or suggest searching
- Verify spelling and organization name
- Check user has access to the project

**No repositories:**
- Inform user the project has no repositories
- Verify project is correct
- Check if repositories are in a different organization

**Clone failures:**
- Report which repository failed and why
- Check network connectivity
- Verify SSH keys are configured
- Check disk space for large repositories

**Directory permission issues:**
- Report permission error clearly
- Suggest using different directory (e.g., ~/repos instead of /usr/local)
- Provide command to fix permissions if needed

**Network issues:**
- Suggest checking internet connection
- Check Azure DevOps status page
- Verify firewall/proxy settings aren't blocking git+ssh

## MCP Setup Reference

If user needs to set up Azure DevOps MCP, guide them through:

### 1. Check if MCP configuration exists

```bash
ls ~/.config/claude/mcp.json
```

If the file doesn't exist, user needs to set up MCP first.

### 2. Install Azure DevOps MCP

```bash
# The specific installation method depends on the MCP server implementation
# Common approach is adding to mcp.json configuration
```

Refer user to Azure DevOps MCP documentation for installation steps.

### 3. Connect to MCP

```bash
/mcp  # In Claude Code
```

This command will show available MCP servers and connection status.

### 4. Test connection

Try listing projects to verify MCP is working:
- The skill will automatically test MCP connection in step 0
- If successful, user will see their Azure DevOps projects listed
- If failed, user will see setup instructions

### 5. Configuration example

A typical MCP configuration for Azure DevOps might look like:

```json
{
  "mcpServers": {
    "azure-devops": {
      "command": "node",
      "args": ["/path/to/azure-devops-mcp/dist/index.js"],
      "env": {
        "AZURE_DEVOPS_ORG_URL": "https://dev.azure.com/your-org",
        "AZURE_DEVOPS_PAT": "your-personal-access-token"
      }
    }
  }
}
```

**Note:** Exact configuration depends on the MCP server implementation being used.

## Prerequisites Verification

✅ **Required:**
- Git must be installed and available
- Azure DevOps MCP connection must be active
- SSH authentication must be configured for Azure DevOps

🔍 **Verification:**
- **Git:** Checked automatically in step 0 with `git --version`
- **MCP:** Checked automatically in step 0 by attempting to list projects
- **SSH:** Checked during first clone attempt (fails gracefully with setup instructions)

## Recovery from Failures

**Partial completion:**
- Repositories that already exist (with `.git` folder) will be skipped
- Re-running the skill after failures will skip already cloned repos automatically
- Only failed repositories will be retried

**Large repositories:**
- Large repositories may take time to clone
- Progress is shown for each repo
- If a clone times out, try cloning that specific repo manually
- Consider using `--depth 1` for shallow clones if full history not needed

**Rate limiting:**
- The skill prevents overwhelming Azure DevOps with parallel clone requests
- If rate limited, wait a few minutes and retry
- Failed repositories can be cloned individually after skill completes
