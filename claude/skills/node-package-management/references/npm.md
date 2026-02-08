# npm Commands

Complete command reference for npm (Node Package Manager).

## Essential Commands

| Task | Command |
|------|---------|
| Install dependencies | `npm install` or `npm ci` (CI) |
| Add package | `npm install <package>` |
| Add dev package | `npm install -D <package>` |
| Remove package | `npm uninstall <package>` |
| Update package | `npm update <package>` |
| List outdated | `npm outdated` |
| Security audit | `npm audit` |
| Fix vulnerabilities | `npm audit fix` |
| Run script | `npm run <script>` |
| Clean install | `npm ci` (uses lock file exactly) |

## npm-Specific Flags

- `--save-exact` → Pin exact version (no `^` or `~`)
- `--legacy-peer-deps` → Ignore peer dependency conflicts (escape hatch)
- `--workspace=<name>` → Target specific workspace
- `--production` → Install only production dependencies
- `--omit=dev` → Skip devDependencies

## npm ci vs npm install

**Use `npm ci` for:**
- CI/CD pipelines
- Production deployments
- Clean installs

**Differences:**
- `npm ci` removes `node_modules` before installing
- `npm ci` fails if `package.json` and `package-lock.json` are out of sync
- `npm ci` is faster and more reliable
- `npm ci` never modifies `package-lock.json`

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
npm install

# Add dependency to specific workspace
npm install <package> --workspace=packages/ui

# Run script in all workspaces
npm run test --workspaces

# Run script in specific workspace
npm run build --workspace=packages/api
```

See [workspaces.md](workspaces.md) for complete workspace guide.

## Scripts

**Run scripts:**
```bash
# Run named script
npm run build

# Run test (shorthand, no "run" needed)
npm test

# Run with arguments
npm run build -- --watch
```

**Lifecycle scripts:**
- `prepare` → Runs before `npm install` completes
- `prepublishOnly` → Runs before `npm publish`
- `postinstall` → Runs after `npm install`

## Cache Management

```bash
# Clear cache
npm cache clean --force

# Verify cache integrity
npm cache verify

# Show cache location
npm config get cache
```

## Configuration

```bash
# List config
npm config list

# Get specific config
npm config get registry

# Set config
npm config set registry https://registry.npmjs.org/

# Delete config
npm config delete proxy
```

## Troubleshooting

**Clear everything and reinstall:**
```bash
rm -rf node_modules package-lock.json
npm cache clean --force
npm install
```

**Check package info:**
```bash
# Show package metadata
npm view <package>

# Show all versions
npm view <package> versions

# Check why package is installed
npm ls <package>
```

**Peer dependency issues:**
```bash
# Use legacy resolver (npm 7+)
npm install --legacy-peer-deps

# Or force install
npm install --force
```
