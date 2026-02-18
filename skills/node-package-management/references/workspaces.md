# Workspaces Guide

Complete guide to monorepo management with npm, pnpm, yarn, and bun workspaces.

## Table of Contents

- [What Are Workspaces?](#what-are-workspaces)
- [npm Workspaces](#npm-workspaces)
- [pnpm Workspaces](#pnpm-workspaces)
- [Yarn Workspaces](#yarn-workspaces)
- [bun Workspaces](#bun-workspaces)
- [Workspace Protocols](#workspace-protocols)
- [Common Patterns](#common-patterns)
- [Troubleshooting](#troubleshooting)

## What Are Workspaces?

Workspaces let you manage multiple packages in a single repository (monorepo):

**Benefits:**
- Shared dependencies (single node_modules or store)
- Cross-package dependencies with symlinks
- Run scripts across all packages
- Simplified versioning and publishing
- Atomic commits across packages

**Use cases:**
- Component libraries with examples
- API + Frontend + Shared utilities
- Multiple apps sharing common packages
- Plugin architectures

## npm Workspaces

**Setup in root `package.json`:**
```json
{
  "name": "my-monorepo",
  "private": true,
  "workspaces": [
    "packages/*",
    "apps/*"
  ]
}
```

**Structure:**
```
my-monorepo/
├── package.json
├── package-lock.json
├── node_modules/
├── packages/
│   ├── ui/
│   │   └── package.json
│   └── utils/
│       └── package.json
└── apps/
    └── web/
        └── package.json
```

**Commands:**

```bash
# Install all workspaces
npm install

# Add dependency to specific workspace
npm install <package> --workspace=packages/ui
npm install <package> -w packages/ui  # shorthand

# Add dependency to multiple workspaces
npm install lodash -w packages/ui -w apps/web

# Run script in specific workspace
npm run build --workspace=packages/ui

# Run script in all workspaces
npm run test --workspaces

# Run script in all workspaces with specific name pattern
npm run build --workspaces --if-present  # skip if no script

# List all workspaces
npm ls --workspaces
```

**Cross-package dependencies:**
```json
{
  "name": "@mycompany/web",
  "dependencies": {
    "@mycompany/ui": "*"
  }
}
```

npm automatically symlinks local packages.

## pnpm Workspaces

**Setup in `pnpm-workspace.yaml`:**
```yaml
packages:
  - 'packages/*'
  - 'apps/*'
  # Exclude specific packages
  - '!**/test/**'
```

**Commands:**

```bash
# Install all workspaces
pnpm install

# Add dependency to specific workspace
pnpm add <package> --filter packages/ui

# Add dependency to all workspaces
pnpm add <package> -r  # recursive

# Run script in specific workspace
pnpm --filter packages/ui run build

# Run script in all workspaces
pnpm -r run test

# Run script in workspace and its dependencies
pnpm --filter ...packages/ui run build

# Run script in workspace and its dependents
pnpm --filter packages/ui... run build

# Run script in parallel (faster)
pnpm -r --parallel run build

# Run script in topological order (dependencies first)
pnpm -r run build  # default behavior
```

**Workspace protocol (recommended):**
```json
{
  "name": "@mycompany/web",
  "dependencies": {
    "@mycompany/ui": "workspace:*",
    "@mycompany/utils": "workspace:^"
  }
}
```

**Protocol versions:**
- `workspace:*` → Link to any version in workspace
- `workspace:^` → Link with caret range (^1.0.0)
- `workspace:~` → Link with tilde range (~1.0.0)
- `workspace:1.0.0` → Link to specific version

**Catalog (pnpm 9+):**

Share versions across workspaces:

```yaml
# pnpm-workspace.yaml
catalog:
  react: ^18.2.0
  typescript: ^5.3.3

packages:
  - 'packages/*'
```

```json
{
  "dependencies": {
    "react": "catalog:"
  }
}
```

## Yarn Workspaces

**Setup in root `package.json`:**
```json
{
  "name": "my-monorepo",
  "private": true,
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

# Run script in specific workspace
yarn workspace packages/ui run build

# Run script in all workspaces
yarn workspaces run test

# Info about workspaces
yarn workspaces info
```

**Yarn 2+ (Berry) commands:**

```bash
# Install all workspaces
yarn install

# Add dependency to specific workspace
yarn workspace packages/ui add <package>

# Run script in specific workspace
yarn workspace packages/ui run build

# Run script in all workspaces
yarn workspaces foreach run test

# Run in parallel
yarn workspaces foreach -p run build

# Run in topological order
yarn workspaces foreach -t run build

# Run only in changed workspaces (since git ref)
yarn workspaces foreach --since=main run test
```

**Constraints (Yarn 2+):**

Enforce version consistency:

```javascript
// .yarnrc.yml
plugins:
  - path: .yarn/plugins/@yarnpkg/plugin-constraints.cjs

// constraints.pro
gen_enforced_dependency(WorkspaceCwd, 'react', '18.2.0', DependencyType) :-
  workspace_has_dependency(WorkspaceCwd, 'react', _, DependencyType).
```

## bun Workspaces

**Setup in root `package.json`:**
```json
{
  "name": "my-monorepo",
  "workspaces": [
    "packages/*",
    "apps/*"
  ]
}
```

**Commands:**

```bash
# Install all workspaces
bun install

# Add dependency to specific workspace (cd into workspace)
cd packages/ui && bun add <package>

# Run script in specific workspace
bun run --filter packages/ui build

# Run script in all workspaces
bun run --filter '*' test

# List workspaces
bun pm ls --all
```

**Note:** bun workspace support is still evolving. Check [bun.sh/docs](https://bun.sh/docs) for latest features.

## Workspace Protocols

**npm and yarn:**
- Use `*` for local packages: `"@mycompany/ui": "*"`
- npm/yarn resolve to local symlink automatically

**pnpm (recommended):**
- Use `workspace:` protocol: `"@mycompany/ui": "workspace:*"`
- More explicit and prevents accidental registry lookups
- Converts to real version range on publish

**When publishing:**
- pnpm replaces `workspace:*` with actual version
- npm/yarn replace `*` with version from local package.json

## Common Patterns

### Root Scripts

Run tasks across all workspaces from root:

```json
{
  "scripts": {
    "build": "npm run build --workspaces",
    "test": "npm run test --workspaces --if-present",
    "lint": "npm run lint --workspaces",
    "clean": "rm -rf packages/*/dist apps/*/dist"
  }
}
```

### Development Workflow

**1. Install dependencies:**
```bash
npm install  # or pnpm install, yarn install
```

**2. Build all packages:**
```bash
npm run build --workspaces
```

**3. Run specific app:**
```bash
npm run dev --workspace=apps/web
```

**4. Add shared dependency:**
```bash
npm install lodash --workspaces  # adds to all
```

### Shared Configuration

**Root tsconfig.json:**
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext"
  }
}
```

**Package tsconfig.json:**
```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist"
  }
}
```

### Hoisting

**npm (automatic):**
- Hoists shared dependencies to root node_modules
- Package-specific versions stay in package node_modules

**pnpm (strict by default):**
- Uses content-addressable store
- Packages can only access declared dependencies
- Use `shamefully-hoist=true` in .npmrc for compatibility

**yarn (configurable):**
- Yarn 1.x: `nohoist` option to prevent hoisting
- Yarn 2+: Plug'n'Play (PnP) instead of hoisting

## Troubleshooting

### Dependency Not Found

**Symptom:** Package can't find a dependency that's installed

**Solution (npm/yarn):**
```bash
# Rebuild node_modules
rm -rf node_modules package-lock.json
npm install
```

**Solution (pnpm):**
```bash
# Check if dependency is declared
pnpm why <package>

# If missing, add it explicitly
pnpm add <package> --filter packages/ui
```

### Symlink Issues

**Symptom:** Build tools complain about symlinked packages

**Solutions:**
- Configure tool to follow symlinks (webpack: `resolve.symlinks: true`)
- Use pnpm with `node-linker=hoisted` in .npmrc
- Build packages before using them

### Version Conflicts

**Symptom:** Different workspaces need different versions

**Solution (pnpm):**
```bash
# Allow different versions
pnpm add react@17 --filter packages/legacy
pnpm add react@18 --filter packages/modern
```

**Solution (npm/yarn):**
- Use resolutions (yarn) or overrides (npm) in root package.json
- Or split into separate repositories

### Circular Dependencies

**Symptom:** Package A depends on B, B depends on A

**Solutions:**
- Extract shared code to separate package
- Restructure to remove circular dependency
- Use peer dependencies if appropriate

### Script Execution Order

**Problem:** Package B needs A to build first

**Solution (pnpm):**
```bash
# Topological order (automatic)
pnpm -r run build
```

**Solution (npm):**
```bash
# Use workspace order (dependencies first)
npm run build --workspaces --if-present
```

**Solution (yarn 2+):**
```bash
# Topological mode
yarn workspaces foreach -t run build
```

### Peer Dependency Warnings

**Symptom:** Peer dependency warnings in monorepo

**Solution:**
- Install peer dependencies in root package.json
- Or in each workspace that needs them
- Use `--legacy-peer-deps` (npm) or `auto-install-peers` (pnpm) as last resort
