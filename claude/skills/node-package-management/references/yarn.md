# yarn Commands

Complete command reference for Yarn (both Classic 1.x and Berry 2+).

## Table of Contents

- [Yarn 1.x (Classic)](#yarn-1x-classic)
- [Yarn 2+ (Berry)](#yarn-2-berry)
- [Yarn 2+ Features](#yarn-2-features)
- [Workspaces](#workspaces)
- [Constraints (Yarn 2+)](#constraints-yarn-2)
- [Interactive Upgrade](#interactive-upgrade)
- [Cache Management](#cache-management)
- [Troubleshooting](#troubleshooting)
- [Migration: Yarn 1.x → Yarn 2+](#migration-yarn-1x--yarn-2)

## Yarn 1.x (Classic)

| Task | Command |
|------|---------|
| Install dependencies | `yarn install` |
| Add package | `yarn add <package>` |
| Add dev package | `yarn add -D <package>` |
| Remove package | `yarn remove <package>` |
| Update package | `yarn upgrade <package>` |
| List outdated | `yarn outdated` |
| Security audit | `yarn audit` |
| Run script | `yarn run <script>` or `yarn <script>` |
| Clean install | `yarn install --frozen-lockfile` |

**Yarn 1.x specific:**
- `--exact` → Pin exact version
- `--ignore-scripts` → Skip install/postinstall scripts (security)
- `--frozen-lockfile` → Fail if lock file needs update (CI)

## Yarn 2+ (Berry)

| Task | Command |
|------|---------|
| Install dependencies | `yarn install` |
| Add package | `yarn add <package>` |
| Add dev package | `yarn add -D <package>` |
| Remove package | `yarn remove <package>` |
| Update package | `yarn up <package>` |
| List outdated | `yarn outdated` |
| Security audit | `yarn npm audit` |
| Run script | `yarn run <script>` or `yarn <script>` |
| Clean install | `yarn install --immutable` |

## Yarn 2+ Features

- **Plug'n'Play (PnP)**: No `node_modules`, faster installs
- **Zero-installs**: Commit `.yarn/cache` for instant CI
- **Constraints**: Enforce version consistency across workspaces
- **Plugins**: Extend functionality

### Plug'n'Play (PnP)

**Enable PnP (.yarnrc.yml):**
```yaml
nodeLinker: pnp
```

**Disable PnP (use node_modules):**
```yaml
nodeLinker: node-modules
```

### Zero-Installs

**Enable:**
```yaml
# .yarnrc.yml
enableGlobalCache: false
```

Then commit `.yarn/cache/` to git for instant installs in CI.

## Workspaces

**Setup in root `package.json`:**
```json
{
  "workspaces": [
    "packages/*",
    "apps/*"
  ]
}
```

**Yarn 1.x commands:**
```bash
# Install all workspaces
yarn install

# Add dependency to specific workspace
yarn workspace packages/ui add <package>

# Run script in all workspaces
yarn workspaces run test

# Run script in specific workspace
yarn workspace packages/api run build
```

**Yarn 2+ commands:**
```bash
# Install all workspaces
yarn install

# Add dependency to specific workspace
yarn workspace packages/ui add <package>

# Run script in all workspaces
yarn workspaces foreach run test

# Run script in specific workspace
yarn workspace packages/api run build
```

See [workspaces.md](workspaces.md) for complete workspace guide.

## Constraints (Yarn 2+)

**Enforce version consistency:**

```javascript
// .yarnrc.yml
plugins:
  - path: .yarn/plugins/@yarnpkg/plugin-constraints.cjs

// constraints.pro
gen_enforced_dependency(WorkspaceCwd, 'react', '18.2.0', DependencyType) :-
  workspace_has_dependency(WorkspaceCwd, 'react', _, DependencyType).
```

## Interactive Upgrade

```bash
# Yarn 1.x - interactive upgrade
yarn upgrade-interactive

# Yarn 1.x - with latest versions
yarn upgrade-interactive --latest
```

## Cache Management

**Yarn 1.x:**
```bash
# Clear cache
yarn cache clean

# Show cache location
yarn cache dir
```

**Yarn 2+:**
```bash
# Clear cache
yarn cache clean --all

# Show cache location
yarn config get cacheFolder
```

## Troubleshooting

**Clear and reinstall:**
```bash
# Yarn 1.x
rm -rf node_modules yarn.lock
yarn cache clean
yarn install

# Yarn 2+
rm -rf node_modules yarn.lock .yarn/cache
yarn install
```

**Check package info:**
```bash
# Show package metadata
yarn info <package>

# Check why package is installed
yarn why <package>

# List dependencies
yarn list --depth=1
```

## Migration: Yarn 1.x → Yarn 2+

```bash
# Enable Yarn 2+
yarn set version stable

# Update .yarnrc.yml as needed
# Commit .yarn/ to git (except .yarn/install-state.gz)
```
