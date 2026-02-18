# Troubleshooting Guide

Common Node.js package management issues, debugging techniques, and migration strategies.

## Table of Contents

- [Installation Issues](#installation-issues)
- [Dependency Conflicts](#dependency-conflicts)
- [Lock File Problems](#lock-file-problems)
- [Workspace Issues](#workspace-issues)
- [Performance Problems](#performance-problems)
- [Platform-Specific Issues](#platform-specific-issues)
- [Migration Between Package Managers](#migration-between-package-managers)
- [Debugging Techniques](#debugging-techniques)

## Installation Issues

### "Cannot find module" After Install

**Symptom:** Import fails even after successful `npm install`

**Causes:**
- Corrupted node_modules
- Incomplete installation
- Case sensitivity (macOS vs Linux)
- Missing peer dependencies

**Solutions:**

```bash
# npm - full reinstall
rm -rf node_modules package-lock.json
npm cache clean --force
npm install

# pnpm - clear store
pnpm store prune
rm -rf node_modules pnpm-lock.yaml
pnpm install

# yarn - clear cache
yarn cache clean
rm -rf node_modules yarn.lock
yarn install

# bun - reinstall
rm -rf node_modules bun.lockb
bun install
```

### "Permission denied" Errors

**Symptom:** `EACCES` or `permission denied` during install

**Cause:** Global packages installed with sudo (wrong permissions)

**Solution:**

```bash
# ❌ NEVER do this
sudo npm install -g typescript

# ✅ Use a version manager instead
# Install nvm (Node Version Manager)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Or fnm (Fast Node Manager)
curl -fsSL https://fnm.vercel.app/install | bash

# Then install Node.js
nvm install 20
npm install -g typescript  # No sudo needed
```

**Quick fix (not recommended):**
```bash
# Change npm global directory ownership
sudo chown -R $(whoami) $(npm config get prefix)/{lib/node_modules,bin,share}
```

### Network/Registry Issues

**Symptom:** Timeouts, connection refused, 404 errors

**Check registry:**
```bash
npm config get registry
# Should be: https://registry.npmjs.org/

# Reset to default
npm config set registry https://registry.npmjs.org/
```

**Check proxy:**
```bash
npm config get proxy
npm config get https-proxy

# Clear proxy if not needed
npm config delete proxy
npm config delete https-proxy
```

**Increase timeout:**
```bash
npm config set timeout 60000  # 60 seconds
```

**Use different registry temporarily:**
```bash
npm install --registry=https://registry.npmjs.org/
```

### Install Hangs or Is Very Slow

**Causes:**
- Network issues
- Large dependency tree
- Postinstall scripts running

**Solutions:**

```bash
# Check what's happening
npm install --verbose

# Skip postinstall scripts (temporary)
npm install --ignore-scripts

# Use faster package manager
pnpm install  # usually 2-3x faster
# or
bun install   # usually 10-20x faster
```

**Progress tracking:**
```bash
# npm - detailed logs
npm install --loglevel=verbose

# pnpm - show progress
pnpm install --reporter=default

# yarn 2+ - show progress
yarn install --inline-builds
```

## Dependency Conflicts

### Peer Dependency Warnings

**Symptom:** Warnings about unmet peer dependencies

**Example:**
```
npm WARN eslint-config-react@1.0.0 requires a peer of eslint@^7.0.0
but eslint@8.0.0 is installed
```

**Solutions:**

```bash
# Option 1: Install compatible version
npm install eslint@^7.0.0

# Option 2: Update package requiring peer
npm update eslint-config-react

# Option 3: Use legacy resolver (npm 7+)
npm install --legacy-peer-deps

# Option 4: Force install (last resort)
npm install --force

# pnpm - auto-install peers
pnpm install --auto-install-peers
```

**Check who needs what:**
```bash
# npm
npm ls <package>

# pnpm - more detailed
pnpm why <package>

# yarn
yarn why <package>
```

### Version Conflicts

**Symptom:** Multiple versions of same package installed

**Check installed versions:**
```bash
# npm
npm ls <package>

# Show dependency tree
npm ls --all

# pnpm
pnpm ls <package> --depth=Infinity

# yarn
yarn list --pattern <package>
```

**Solutions:**

```bash
# npm - deduplicate
npm dedupe

# pnpm - automatically handles duplicates
pnpm install

# yarn 1.x - deduplicate
yarn dedupe

# yarn 2+ - uses PnP (no duplicates)
```

**Force single version (resolutions):**

```json
// package.json

// npm (npm 8.3+)
{
  "overrides": {
    "lodash": "4.17.21"
  }
}

// yarn
{
  "resolutions": {
    "lodash": "4.17.21"
  }
}

// pnpm
{
  "pnpm": {
    "overrides": {
      "lodash": "4.17.21"
    }
  }
}
```

## Lock File Problems

### Lock File Out of Sync

**Symptom:** `package-lock.json` and `package.json` don't match

**In CI/CD:**
```bash
# Use strict install (fails if out of sync)
npm ci  # not npm install

# pnpm
pnpm install --frozen-lockfile

# yarn
yarn install --frozen-lockfile  # Yarn 1.x
yarn install --immutable        # Yarn 2+
```

**In development:**
```bash
# Update lock file to match package.json
npm install  # regenerates lock file

# Or delete and regenerate
rm package-lock.json
npm install
```

### Merge Conflicts in Lock File

**Symptom:** Git merge conflicts in `package-lock.json`

**Solution:**
```bash
# 1. Accept either version (or both)
git checkout --ours package-lock.json
# or
git checkout --theirs package-lock.json

# 2. Regenerate lock file
rm package-lock.json
npm install

# 3. Verify it works
npm ci

# 4. Commit resolved lock file
git add package-lock.json
git commit -m "fix: resolve lock file conflict"
```

**Prevention:**
```bash
# Keep lock file up to date
npm install  # after pulling changes
```

### Corrupted Lock File

**Symptom:** Installation fails with parse errors

**Solution:**
```bash
# Delete and regenerate
rm package-lock.json  # or pnpm-lock.yaml, yarn.lock
npm install

# Verify integrity
npm ci
```

## Workspace Issues

### Package Not Found in Workspace

**Symptom:** Workspace package import fails

**Check workspace setup:**

```bash
# npm - list workspaces
npm ls --workspaces

# pnpm - list workspaces
pnpm ls -r --depth -1

# yarn - list workspaces
yarn workspaces info
```

**Verify workspace config:**

```json
// package.json (npm/yarn/bun)
{
  "workspaces": [
    "packages/*"
  ]
}

// pnpm-workspace.yaml (pnpm)
packages:
  - 'packages/*'
```

**Rebuild workspace links:**
```bash
# npm
rm -rf node_modules
npm install

# pnpm
pnpm install

# yarn 2+
yarn install
```

### Workspace Hoisting Issues

**Symptom:** Package works locally but not in workspace

**pnpm - explicitly add dependency:**
```bash
# pnpm is strict - must declare all dependencies
pnpm add <missing-package> --filter workspace-name
```

**npm/yarn - check hoisting:**
```bash
# Verify package location
npm ls <package>

# Check if hoisted to root
ls node_modules/<package>
```

**Disable hoisting (if needed):**

```json
// .npmrc (pnpm)
shamefully-hoist=false

// .yarnrc.yml (yarn 2+)
nmHoistingLimits: workspaces
```

## Performance Problems

### Slow Install Times

**Benchmark package managers:**
```bash
# Clean install test
rm -rf node_modules package-lock.json

# npm
time npm install

# pnpm (usually 2-3x faster)
time pnpm install

# yarn 2+
time yarn install

# bun (usually 10-20x faster)
time bun install
```

**Optimize npm:**
```bash
# Use npm ci in CI (faster than install)
npm ci

# Disable progress bar (slight speedup)
npm install --no-progress

# Use cache
npm install --prefer-offline
```

**Optimize pnpm:**
```bash
# Use store (default, fastest)
pnpm install

# Parallel downloads
pnpm install --network-concurrency=10
```

**Optimize yarn 2+:**
```bash
# Enable PnP (faster than node_modules)
# .yarnrc.yml
nodeLinker: pnp

# Zero-installs (commit .yarn/cache)
enableGlobalCache: false
```

### Large node_modules

**Check size:**
```bash
du -sh node_modules
# or more detailed
npx disk-usage

# Find largest packages
du -sh node_modules/* | sort -rh | head -20
```

**Reduce size:**

```bash
# Remove unnecessary packages
npm uninstall <unused-packages>

# Remove dev dependencies (production build)
npm prune --production

# Deduplicate
npm dedupe

# Switch to pnpm (saves disk space)
# pnpm uses hard links - shared global store
```

**pnpm store stats:**
```bash
pnpm store status
# Shows: store size, number of packages
```

## Platform-Specific Issues

### Windows vs macOS/Linux

**Path separators:**
```json
// ❌ Bad - Windows-only
{
  "scripts": {
    "build": "rmdir /s /q dist && webpack"
  }
}

// ✅ Good - cross-platform
{
  "scripts": {
    "build": "rimraf dist && webpack"
  }
}
```

**Use cross-platform tools:**
```bash
npm install --save-dev rimraf  # instead of rm -rf
npm install --save-dev cross-env  # for env vars
```

**Example:**
```json
{
  "scripts": {
    "clean": "rimraf dist",
    "build": "cross-env NODE_ENV=production webpack"
  }
}
```

### Line Endings (Windows)

**Issue:** Git converts LF to CRLF on Windows

**Solution:**
```bash
# .gitattributes
* text=auto
*.sh text eol=lf
*.js text eol=lf
```

### Symbolic Links

**Issue:** Symlinks don't work on Windows (workspaces)

**Solutions:**
- Enable Developer Mode on Windows 10/11
- Run terminal as Administrator
- Use pnpm with `node-linker=hoisted` in .npmrc

## Migration Between Package Managers

### npm → pnpm

```bash
# 1. Install pnpm
npm install -g pnpm

# 2. Import from package-lock.json
pnpm import

# 3. Verify it works
pnpm install

# 4. Remove npm artifacts
rm package-lock.json

# 5. Commit new lock file
git add pnpm-lock.yaml
git commit -m "chore: migrate to pnpm"
```

**Workspace migration:**
```yaml
# Create pnpm-workspace.yaml
packages:
  - 'packages/*'
  - 'apps/*'
```

### npm → yarn

```bash
# 1. Install yarn
npm install -g yarn

# 2. Generate yarn.lock
yarn install

# 3. Verify it works
yarn install --frozen-lockfile

# 4. Remove npm artifacts
rm package-lock.json

# 5. Commit
git add yarn.lock
git commit -m "chore: migrate to yarn"
```

### yarn → pnpm

```bash
# 1. Install pnpm
npm install -g pnpm

# 2. Remove yarn lock
rm yarn.lock

# 3. Install with pnpm
pnpm install

# 4. Create workspace file (if using workspaces)
# pnpm-workspace.yaml
packages:
  - 'packages/*'

# 5. Commit
git add pnpm-lock.yaml pnpm-workspace.yaml
git commit -m "chore: migrate to pnpm"
```

### npm → bun

```bash
# 1. Install bun
curl -fsSL https://bun.sh/install | bash

# 2. Remove npm artifacts
rm -rf node_modules package-lock.json

# 3. Install with bun
bun install

# 4. Verify it works
bun install --frozen-lockfile

# 5. Commit
git add bun.lockb
git commit -m "chore: migrate to bun"
```

## Debugging Techniques

### Verbose Logging

**npm:**
```bash
npm install --loglevel=verbose
# or
npm install --dd  # very verbose

# Log to file
npm install --loglevel=verbose > npm-debug.log 2>&1
```

**pnpm:**
```bash
pnpm install --reporter=default
# or
pnpm install -d  # debug mode
```

**yarn:**
```bash
yarn install --verbose

# yarn 2+ - trace
yarn install --inline-builds
```

### Check Package Registry

**Verify package exists:**
```bash
npm view <package>
# or
npm info <package>

# Check all versions
npm view <package> versions

# Check latest version
npm view <package> version
```

### Inspect Dependency Tree

**npm:**
```bash
# Show tree
npm ls

# Show specific package
npm ls <package>

# Show all levels
npm ls --all

# Show only production
npm ls --prod
```

**pnpm:**
```bash
pnpm ls --depth=Infinity

# Show why package is installed
pnpm why <package>
```

**yarn:**
```bash
yarn list

# Show why package is installed
yarn why <package>
```

### Cache Issues

**Clear all caches:**
```bash
# npm
npm cache clean --force
npm cache verify

# pnpm
pnpm store prune

# yarn 1.x
yarn cache clean

# yarn 2+
yarn cache clean --all

# bun
rm -rf ~/.bun/install/cache
```

### Check Configuration

**npm:**
```bash
# List all config
npm config list

# Show config locations
npm config list -l

# Check specific setting
npm config get registry
npm config get proxy
```

**pnpm:**
```bash
# Show config
pnpm config list

# Show specific setting
pnpm config get store-dir
```

**yarn:**
```bash
# yarn 1.x
yarn config list

# yarn 2+
yarn config
```

### Test in Clean Environment

**Docker:**
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm test
```

**Test without cache:**
```bash
# npm
npm ci --cache .npm-cache

# pnpm - use temp store
pnpm install --store-dir=/tmp/pnpm-store
```

### Reproduce in CI

**GitHub Actions:**
```yaml
- name: Install dependencies
  run: npm ci

- name: Verify install
  run: npm ls
```

**Debug CI issues locally:**
```bash
# Act (run GitHub Actions locally)
act -j build

# Or replicate CI environment
docker run -it node:20 bash
cd /tmp && git clone <repo>
npm ci
```

## Common Error Messages

### ERESOLVE unable to resolve dependency tree

**Cause:** Conflicting peer dependencies (npm 7+)

**Solutions:**
```bash
# Option 1: Use legacy resolver
npm install --legacy-peer-deps

# Option 2: Force install
npm install --force

# Option 3: Fix dependency versions
# Check npm ls and resolve conflicts manually
```

### ENOENT: no such file or directory

**Cause:** File/directory missing or deleted mid-install

**Solution:**
```bash
# Clean install
rm -rf node_modules package-lock.json
npm install
```

### integrity checksum failed

**Cause:** Corrupted package download or tampered package

**Solutions:**
```bash
# Clear cache and retry
npm cache clean --force
npm install

# If persists - possible supply chain attack
# Check package on npm registry
npm view <package>
```

### EACCES: permission denied

**Cause:** Insufficient permissions

**Solution:** See [Permission denied](#permission-denied-errors) section above

### ERR_SOCKET_TIMEOUT

**Cause:** Network timeout

**Solutions:**
```bash
# Increase timeout
npm config set timeout 60000

# Check network/proxy
npm config get proxy
npm config get https-proxy

# Use different registry
npm install --registry=https://registry.npmjs.org/
```
