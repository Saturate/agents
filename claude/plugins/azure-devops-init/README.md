# Azure DevOps Init Plugin

A Claude Code plugin that helps you quickly initialize local development environments from Azure DevOps projects by automatically cloning all repositories.

## Features

- 🔍 Find Azure DevOps projects by name or ID
- 📦 Clone all repositories from a project in one command
- 🗂️ Automatically organize repos in a clean folder structure
- ⚡ Skip repositories that already exist locally
- 🛡️ Built-in error handling for MCP and SSH issues
- 📊 Progress reporting and final summary

## Prerequisites

Before using this plugin, ensure you have:

1. **Azure DevOps MCP** installed and connected
   - Run `/mcp` in Claude Code to set up
   - GitHub: [azure-devops-mcp](https://github.com/brynshanahan/azure-devops-mcp)

2. **SSH authentication** configured for Azure DevOps
   - Generate SSH key: `ssh-keygen -t rsa -b 4096`
   - Add to Azure DevOps: https://dev.azure.com/{org}/_usersSettings/keys

3. **Git** installed on your system

## Installation

### As a Standalone Skill

Copy the skill to your Claude Code skills directory:

```bash
cp -r skills/azure-init ~/.claude/skills/
```

### As a Plugin

Copy the plugin to your Claude Code plugins directory:

```bash
cp -r plugins/azure-devops-init ~/.claude/plugins/local/
```

## Usage

### Basic Usage

Clone all repositories from a project to the default location (`~/code/{project-name}`):

```bash
/azure-init "DCC Energi"
```

### Custom Directory

Specify a custom target directory:

```bash
/azure-init "DCC Energi" ~/projects/dcc
```

### Using Project ID

Use the project ID directly instead of name:

```bash
/azure-init 0d1e562b-95af-4c55-a8ce-8f26508d50ed
```

## How It Works

1. **Checks** if Azure DevOps MCP is connected
2. **Finds** the specified project by name or ID
3. **Lists** all repositories in the project
4. **Creates** the target directory structure
5. **Clones** each repository via SSH
6. **Reports** success/failure summary with next steps

## Example Output

```
Found project: DCC Energi (0d1e562b-95af-4c55-a8ce-8f26508d50ed)

Repositories:
1. DCC Energi (8.1 MB)
2. DCC Energi.CRM (246 KB)
3. DCC.Api (106 KB)
4. DCC.Hosting (69 KB)

Cloning to ~/code/dcc-energi...

✓ Cloned DCC-Energi
✓ Cloned DCC-Energi-CRM
✓ Cloned DCC-Api
✓ Cloned DCC-Hosting

Summary:
- 4 repositories cloned successfully
- 0 skipped (already existed)
- 0 failed

Next steps:
cd ~/code/dcc-energi
```

## Error Handling

The plugin handles common errors gracefully:

- **MCP not connected**: Provides setup instructions
- **SSH not configured**: Shows how to generate and add SSH keys
- **Project not found**: Lists available projects
- **Clone failures**: Reports specific errors and continues with remaining repos
- **Network issues**: Suggests troubleshooting steps

## Future Enhancements

Planned features for this plugin:

- [ ] Support for HTTPS cloning (in addition to SSH)
- [ ] Selective repository cloning (choose specific repos)
- [ ] Branch selection during clone
- [ ] Pull request creation workflow
- [ ] Work item management integration
- [ ] Pipeline status monitoring

## Contributing

Feel free to extend this plugin with additional Azure DevOps functionality!

## License

MIT

## Links

- [Azure DevOps MCP](https://github.com/brynshanahan/azure-devops-mcp)
- [Azure DevOps SSH Setup](https://learn.microsoft.com/en-us/azure/devops/repos/git/use-ssh-keys-to-authenticate)
- [Claude Code Documentation](https://github.com/anthropics/claude-code)
