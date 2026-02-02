# Azure DevOps MCP Installation Guide

Reference for: Azure DevOps Project Initialization

Quick guide to installing the Microsoft Azure DevOps MCP server as an alternative to Azure CLI.

## When to Use MCP vs Azure CLI

**Use Azure CLI if:**
- You already have it installed
- You prefer command-line tools
- You want the mature, stable option

**Use MCP if:**
- You're using other MCP servers
- You prefer structured AI tool interfaces
- You want 100+ Azure DevOps tools available

## Quick Installation

```bash
claude mcp add azure-devops -s user -- npx -y @azure-devops/mcp YOUR-ORG
```

Replace `YOUR-ORG` with your Azure DevOps organization name (e.g., `contoso` from `https://dev.azure.com/contoso`).

## Verify

```bash
claude mcp list
```

Expected output:
```
azure-devops: npx -y @azure-devops/mcp YOUR-ORG - ✓ Connected
```

## Authentication

On first use, the MCP server will open a browser for Microsoft authentication. Credentials are cached automatically.

## Documentation

- **GitHub**: https://github.com/microsoft/azure-devops-mcp
- **Getting Started**: https://github.com/microsoft/azure-devops-mcp/blob/main/docs/GETTINGSTARTED.md
- **Toolset**: https://github.com/microsoft/azure-devops-mcp/blob/main/docs/TOOLSET.md
