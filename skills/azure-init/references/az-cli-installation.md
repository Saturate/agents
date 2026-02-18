# Azure CLI Installation Guide

Reference for: Azure DevOps Project Initialization

Guide to installing and configuring Azure CLI for Azure DevOps access.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Installation](#installation) - macOS, Linux, Windows
3. [Install Azure DevOps Extension](#install-azure-devops-extension)
4. [Authentication](#authentication) - Interactive login or PAT
5. [Configuration](#configuration) - Set default organization
6. [Verify Installation](#verify-installation)
7. [SSH Setup](#ssh-setup-required-for-cloning)
8. [Documentation](#documentation)

## Prerequisites

- macOS, Linux, or Windows (WSL)
- Internet connection
- Azure DevOps organization access

## Installation

### macOS

```bash
brew install azure-cli
```

### Linux (Debian/Ubuntu)

```bash
curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash
```

### Linux (RPM-based)

```bash
sudo rpm --import https://packages.microsoft.com/keys/microsoft.asc
sudo dnf install -y azure-cli
```

### Windows (WSL)

Use the Linux installation method above inside WSL.

### Other Methods

See: https://learn.microsoft.com/en-us/cli/azure/install-azure-cli

## Install Azure DevOps Extension

After installing Azure CLI, add the Azure DevOps extension:

```bash
az extension add -n azure-devops
```

Verify it's installed:

```bash
az extension list --output table
```

## Authentication

### Option 1: Interactive Login (Recommended)

```bash
az login
```

This opens a browser for Azure authentication. Your credentials are cached.

### Option 2: Personal Access Token (PAT)

**Create a PAT:**
1. Go to: `https://dev.azure.com/YOUR-ORG/_usersSettings/tokens`
2. Click "New Token"
3. Set scopes: Code (Read), Project and Team (Read)
4. Copy the token

**Configure:**

```bash
export AZURE_DEVOPS_EXT_PAT="your-pat-token"
```

Add to `~/.zshrc` or `~/.bashrc` to make permanent.

## Configuration

Set your default organization:

```bash
az devops configure --defaults organization=https://dev.azure.com/YOUR-ORG
```

Replace `YOUR-ORG` with your Azure DevOps organization name.

## Verify Installation

Test everything works:

```bash
az devops project list
```

You should see a list of your Azure DevOps projects.

## SSH Setup (Required for Cloning)

The skill uses SSH to clone repositories. Configure SSH keys:

### Generate SSH Key

```bash
ssh-keygen -t rsa -b 4096 -C "your.email@example.com"
```

### Add to Azure DevOps

1. Copy your public key:
   ```bash
   cat ~/.ssh/id_rsa.pub
   ```

2. Go to: `https://dev.azure.com/YOUR-ORG/_usersSettings/keys`
3. Click "New Key"
4. Paste your public key
5. Save

### Test SSH Connection

```bash
ssh -T git@ssh.dev.azure.com
```

## Documentation

- **Azure CLI docs**: https://learn.microsoft.com/en-us/cli/azure/
- **az devops reference**: https://learn.microsoft.com/en-us/cli/azure/devops
- **SSH setup**: https://learn.microsoft.com/en-us/azure/devops/repos/git/use-ssh-keys-to-authenticate
