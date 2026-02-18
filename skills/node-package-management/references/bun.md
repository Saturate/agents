# bun Commands

Complete command reference for bun (JavaScript runtime and package manager).

## Table of Contents

- [Essential Commands](#essential-commands)
- [bun Advantages](#bun-advantages)
- [bun-Specific Flags](#bun-specific-flags)
- [Running Scripts](#running-scripts)
- [Workspaces](#workspaces)
- [bun as Runtime](#bun-as-runtime)
- [bun vs Node.js](#bun-vs-nodejs)
- [Configuration](#configuration)
- [Cache Management](#cache-management)
- [Troubleshooting](#troubleshooting)
- [Global Packages](#global-packages)
- [Migration to bun](#migration-to-bun)
- [When to Use bun](#when-to-use-bun)

## Essential Commands

| Task | Command |
|------|---------|
| Install dependencies | `bun install` |
| Add package | `bun add <package>` |
| Add dev package | `bun add -d <package>` |
| Remove package | `bun remove <package>` |
| Update package | `bun update <package>` |
| List outdated | `bun outdated` |
| Security audit | `npm audit` (use npm) |
| Run script | `bun run <script>` or `bun <script>` |
| Clean install | `bun install --frozen-lockfile` |

## bun Advantages

- **Speed**: 20-100x faster than npm/yarn for installs
- **Runtime**: Can run TypeScript/JSX directly without transpiling
- **All-in-one**: Package manager + runtime + bundler + test runner
- **Compatibility**: Drop-in replacement for Node.js in most cases
- **Binary lockfile**: `bun.lockb` is compact and efficient

## bun-Specific Flags

- `--frozen-lockfile` → Fail if lock file needs update (CI)
- `--production` → Install only production dependencies
- `--no-save` → Install without updating package.json
- `--dev` or `-d` → Add to devDependencies
- `--exact` → Pin exact version
- `--global` or `-g` → Install globally

## Running Scripts

**Direct execution:**
```bash
# Run TypeScript directly (no build step)
bun run index.ts

# Run JavaScript
bun run index.js

# Watch mode
bun --watch index.ts
```

**Package scripts:**
```bash
# Run named script
bun run build

# Run test (shorthand)
bun test

# Run with arguments
bun run build -- --watch
```

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

**Commands:**
```bash
# Install all workspaces
bun install

# Add dependency to specific workspace
cd packages/ui && bun add <package>

# Run script in all workspaces
bun run --filter '*' test

# Run script in specific workspace
bun run --filter packages/api build
```

**Note:** bun workspaces follow npm workspace conventions. See [workspaces.md](workspaces.md) for complete guide.

## bun as Runtime

**Run TypeScript/JSX directly:**
```bash
# No compilation needed
bun run app.tsx

# With environment variables
PORT=3000 bun run server.ts

# Watch mode for development
bun --watch server.ts
```

**Run tests:**
```bash
# Run all tests (built-in test runner)
bun test

# Run specific test file
bun test auth.test.ts

# Watch mode
bun test --watch
```

## bun vs Node.js

**Drop-in replacement for Node.js:**
- Use `bun` instead of `node` to run files
- Most npm packages work without changes
- Built-in support for `.env` files
- Native TypeScript/JSX support

**Not supported:**
- Some native Node.js modules (fs watchers, worker threads)
- Some npm packages with native bindings
- Check compatibility: [bun.sh/docs/runtime/compatibility](https://bun.sh/docs/runtime/compatibility)

## Configuration

**bunfig.toml:**
```toml
[install]
# Use exact versions
exact = true

# Skip installing optional dependencies
optional = false

# Production install by default
production = false

[install.cache]
# Disable cache (not recommended)
disable = false
```

## Cache Management

```bash
# Clear cache (rare, bun manages cache efficiently)
rm -rf ~/.bun/install/cache

# Show bun version
bun --version

# Upgrade bun itself
bun upgrade
```

## Troubleshooting

**Clear and reinstall:**
```bash
rm -rf node_modules bun.lockb
bun install
```

**Check package info:**
```bash
# Show package metadata (use npm)
npm view <package>

# List dependencies
bun pm ls

# Check why package is installed
bun pm ls <package>
```

**Compatibility issues:**
```bash
# Force use of npm for specific package
npm install <problem-package>

# Check bun compatibility
bun --help
```

**Switch to Node.js temporarily:**
```bash
# If bun has compatibility issues
node index.js  # instead of bun run index.js
npm install    # instead of bun install
```

## Global Packages

```bash
# Install globally
bun add -g <package>

# List global packages
bun pm ls -g

# Remove global package
bun remove -g <package>
```

## Migration to bun

**From npm:**
```bash
# Remove npm artifacts
rm -rf node_modules package-lock.json

# Install with bun
bun install
```

**From yarn:**
```bash
# Remove yarn artifacts
rm -rf node_modules yarn.lock

# Install with bun
bun install
```

**From pnpm:**
```bash
# Remove pnpm artifacts
rm -rf node_modules pnpm-lock.yaml

# Install with bun
bun install
```

**Note:** bun reads package.json and creates bun.lockb automatically.

## When to Use bun

**Good for:**
- New projects starting fresh
- Development environments (fast installs, watch mode)
- Running TypeScript without build steps
- Projects with simple dependency trees
- Teams comfortable with bleeding-edge tools

**Avoid for:**
- Projects with many native Node.js modules
- Enterprise environments requiring stability
- Projects with strict npm compatibility requirements
- CI/CD pipelines not yet supporting bun
