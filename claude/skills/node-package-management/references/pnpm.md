# pnpm Commands

Complete command reference for pnpm (Performant npm).

## Essential Commands

| Task | Command |
|------|---------|
| Install dependencies | `pnpm install` |
| Add package | `pnpm add <package>` |
| Add dev package | `pnpm add -D <package>` |
| Remove package | `pnpm remove <package>` |
| Update package | `pnpm update <package>` |
| List outdated | `pnpm outdated` |
| Security audit | `pnpm audit` |
| Run script | `pnpm run <script>` or `pnpm <script>` |
| Clean install | `pnpm install --frozen-lockfile` |

## pnpm Advantages

- **Disk efficiency**: Content-addressable storage saves 100s of GB
- **Strict**: Prevents phantom dependencies (can't import unlisted packages)
- **Fast**: Symlink-based installation is faster than copying
- **Monorepo-friendly**: Built-in workspace support

## pnpm-Specific Flags

- `--filter <package>` → Target workspace package
- `--recursive` or `-r` → Run command in all workspace packages
- `--frozen-lockfile` → Fail if lock file needs update (CI)
- `--save-exact` → Pin exact version
- `--auto-install-peers` → Automatically install peer dependencies

## Workspaces

**Setup in `pnpm-workspace.yaml`:**
```yaml
packages:
  - 'packages/*'
  - 'apps/*'
```

**Commands:**
```bash
# Install all workspaces
pnpm install

# Add dependency to specific workspace
pnpm add <package> --filter packages/ui

# Run script in all workspaces
pnpm -r run test

# Run script in specific workspace
pnpm --filter packages/api run build

# Run script in workspace and its dependencies
pnpm --filter ...packages/api run build
```

**Workspace protocol:**
```json
{
  "dependencies": {
    "ui": "workspace:*"
  }
}
```

See [workspaces.md](workspaces.md) for complete workspace guide.

## pnpm Store

**Store management:**
```bash
# Prune unused packages from store
pnpm store prune

# Show store path
pnpm store path

# Check store status
pnpm store status
```

## Catalog (pnpm 9+)

**Shared versions across workspaces:**
```yaml
# pnpm-workspace.yaml
catalog:
  react: ^18.2.0
  typescript: ^5.3.3

packages:
  - 'packages/*'
```

**Use in package.json:**
```json
{
  "dependencies": {
    "react": "catalog:"
  }
}
```

## Configuration

**`.npmrc` for pnpm:**
```
# Strict peer dependencies
strict-peer-dependencies=true

# Auto install peers
auto-install-peers=true

# Shamefully hoist (for compatibility)
shamefully-hoist=false
```

## Troubleshooting

**Clear store and reinstall:**
```bash
pnpm store prune
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

**Check package info:**
```bash
# Show package metadata
pnpm view <package>

# Check why package is installed
pnpm why <package>

# List dependencies
pnpm list --depth=1
```

**Peer dependency issues:**
```bash
# Auto-install peer dependencies
pnpm install --auto-install-peers

# See which package needs which peer
pnpm why <peer-package>
```
