# Troubleshooting Guide

Reference for: Azure DevOps Project Initialization

Common errors and their resolutions when initializing Azure DevOps projects.

## Table of Contents

1. [Azure DevOps Access Not Available](#azure-devops-access-not-available)
2. [SSH Not Configured](#ssh-not-configured)
3. [Other Common Errors](#other-common-errors)
4. [Installation Guides](#installation-guides)
5. [Prerequisites Verification](#prerequisites-verification)
6. [Recovery from Failures](#recovery-from-failures)

---

## Azure DevOps Access Not Available

If neither Azure CLI nor MCP is available:

```
Azure DevOps access not configured.

Option 1 (Recommended): Install Azure CLI
  macOS: brew install azure-cli
  Linux: curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash
  Then: az extension add -n azure-devops

Option 2 (Alternative): Install MCP
  claude mcp add azure-devops -s user -- npx -y @azure-devops/mcp YOUR-ORG

See references/az-cli-installation.md or references/mcp-installation.md
```

## SSH Not Configured

If git clone fails with "Permission denied (publickey)":

```
SSH authentication failed. You need to configure SSH keys for Azure DevOps.

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

## Installation Guides

**Azure CLI (recommended):**
- Complete installation guide: [az-cli-installation.md](az-cli-installation.md)
- Quick install: `brew install azure-cli && az extension add -n azure-devops`
- Auth: `az login`

**MCP (alternative):**
- Complete installation guide: [mcp-installation.md](mcp-installation.md)
- Quick install: `claude mcp add azure-devops -s user -- npx -y @azure-devops/mcp YOUR-ORG`
- Auth: Automatic browser-based OAuth

## Prerequisites Verification

**Required:**
- Git must be installed and available
- Azure CLI with azure-devops extension OR Azure DevOps MCP
- Azure DevOps authentication configured
- SSH authentication must be configured for Azure DevOps

**Verification:**
- **Git:** Checked automatically in step 0 with `git --version`
- **Azure DevOps access:** Checked automatically (tries Azure CLI first, then MCP fallback)
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
