# Security Best Practices

Comprehensive guide to Node.js dependency security, vulnerability management, and safe versioning strategies.

## Table of Contents

- [Vulnerability Scanning](#vulnerability-scanning)
- [Lock Files](#lock-files)
- [Version Management](#version-management)
- [Secrets Management](#secrets-management)
- [Supply Chain Attacks](#supply-chain-attacks)
- [CI/CD Integration](#cicd-integration)
- [Best Practices](#best-practices)

## Vulnerability Scanning

### npm audit

**Check for vulnerabilities:**
```bash
# Run audit
npm audit

# Show detailed report
npm audit --json

# Fix vulnerabilities automatically
npm audit fix

# Fix including breaking changes
npm audit fix --force  # ⚠️ may break things
```

**CI/CD integration:**
```bash
# Fail CI if high/critical vulnerabilities found
npm audit --audit-level=high

# Fail on moderate or higher
npm audit --audit-level=moderate
```

**Audit levels:**
- `info` → Informational only
- `low` → Low severity
- `moderate` → Moderate severity
- `high` → High severity (recommended threshold)
- `critical` → Critical vulnerabilities only

### pnpm audit

**Check for vulnerabilities:**
```bash
# Run audit
pnpm audit

# Show JSON report
pnpm audit --json

# Fix vulnerabilities (manual)
pnpm update <package> --latest
```

**CI/CD integration:**
```bash
# Fail CI on high/critical
pnpm audit --audit-level=high
```

**Note:** pnpm doesn't have automatic fix like npm. Update packages manually.

### yarn audit

**Yarn 1.x:**
```bash
# Run audit
yarn audit

# Show JSON report
yarn audit --json
```

**Yarn 2+ (Berry):**
```bash
# Run audit
yarn npm audit

# Show all vulnerabilities
yarn npm audit --all

# Fix requires manual update
yarn up <package>
```

### bun (use npm audit)

```bash
# bun doesn't have built-in audit yet
npm audit  # works with node_modules

# Or use third-party tools
npx better-npm-audit audit
```

## Lock Files

### Why Lock Files Matter

**Lock files freeze dependency versions:**
- Ensures reproducible installs
- Prevents supply chain attacks
- Records exact versions and checksums
- Critical for security and stability

**Lock file by package manager:**
- npm → `package-lock.json`
- pnpm → `pnpm-lock.yaml`
- yarn → `yarn.lock`
- bun → `bun.lockb`

### Lock File Security

**Always commit lock files:**
```bash
# .gitignore should NOT include:
# package-lock.json
# pnpm-lock.yaml
# yarn.lock
# bun.lockb
```

**Why committing lock files is critical:**
- Prevents dependency confusion attacks
- Ensures team uses same versions
- Blocks malicious updates between dev and CI
- Provides audit trail of dependency changes

**Review lock file changes:**
```bash
# Before committing, check lock file diff
git diff package-lock.json

# Look for unexpected changes:
# - New dependencies you didn't add
# - Version jumps (1.0.0 → 9.0.0)
# - Registry URL changes
```

### Integrity Checks

**npm:**
```bash
# Verify lock file integrity
npm ci  # fails if package.json and lock file mismatch

# Don't use npm install in CI (modifies lock file)
```

**pnpm:**
```bash
# Strict install (fails if lock file needs update)
pnpm install --frozen-lockfile

# CI should always use this
```

**yarn:**
```bash
# Yarn 1.x
yarn install --frozen-lockfile

# Yarn 2+
yarn install --immutable
```

**bun:**
```bash
# Frozen lockfile
bun install --frozen-lockfile
```

## Version Management

### Semantic Versioning

**Version syntax in package.json:**

```json
{
  "dependencies": {
    "exact": "1.2.3",           // Exact version only
    "caret": "^1.2.3",          // >=1.2.3 <2.0.0 (default)
    "tilde": "~1.2.3",          // >=1.2.3 <1.3.0
    "range": ">=1.2.0 <1.5.0",  // Custom range
    "wildcard": "*",            // ❌ Dangerous - any version
    "latest": "latest"          // ❌ Dangerous - unpredictable
  }
}
```

**Security implications:**

| Syntax | Risk | Use Case |
|--------|------|----------|
| `1.2.3` | ✅ Lowest | Critical dependencies, maximum stability |
| `~1.2.3` | ✅ Low | Patch updates only (bug fixes) |
| `^1.2.3` | ⚠️ Medium | Minor updates (new features, default) |
| `>=1.0.0` | ❌ High | Wide ranges (avoid) |
| `*` | ❌ Critical | Any version (never use) |

### Version Strategies

**Maximum security (recommended for production):**
```json
{
  "dependencies": {
    "react": "18.2.0",
    "lodash": "4.17.21"
  }
}
```

Install with exact versions:
```bash
npm install --save-exact <package>
pnpm add --save-exact <package>
yarn add --exact <package>
```

**Balanced (allow patch updates):**
```json
{
  "dependencies": {
    "react": "~18.2.0",  // 18.2.x only
    "lodash": "~4.17.21"
  }
}
```

**Flexible (default, allow minor updates):**
```json
{
  "dependencies": {
    "react": "^18.2.0",  // 18.x.x
    "lodash": "^4.17.21"
  }
}
```

### Checking Outdated Packages

**npm:**
```bash
npm outdated

# Update to latest within semver range
npm update

# Update to latest (breaking)
npm update --latest  # ⚠️ may break
```

**pnpm:**
```bash
pnpm outdated

# Update within range
pnpm update

# Update to latest
pnpm update --latest
```

**yarn:**
```bash
yarn outdated

# Yarn 1.x - interactive upgrade
yarn upgrade-interactive

# Yarn 2+
yarn up <package>
```

**bun:**
```bash
bun outdated

# Update packages
bun update
```

## Secrets Management

### Never Commit Secrets

**Common secrets to protect:**
- API keys
- Database passwords
- Private keys
- OAuth tokens
- Session secrets

**Use environment variables:**
```bash
# .env (add to .gitignore)
DATABASE_URL=postgresql://user:pass@localhost/db
API_KEY=secret-key-123

# Load in code
require('dotenv').config()
console.log(process.env.API_KEY)
```

**.gitignore must include:**
```
.env
.env.local
.env.*.local
*.key
*.pem
secrets/
```

### Check for Leaked Secrets

**Scan for secrets in dependencies:**
```bash
# Check for known malicious packages
npx socket security <package-name>

# Scan package.json dependencies
npx socket security --all
```

**Scan codebase for secrets:**
```bash
# Use git-secrets or similar
git-secrets --scan

# Or trufflehog
trufflehog git file://. --since-commit HEAD~10
```

## Supply Chain Attacks

### Dependency Confusion

**Attack:** Attacker publishes malicious package with same name as your private package

**Prevention:**
```bash
# Use scoped packages
@mycompany/utils  # safer than "utils"

# Configure registry for private scope
npm config set @mycompany:registry https://npm.pkg.github.com
```

### Typosquatting

**Attack:** Malicious package with similar name (`requst` instead of `request`)

**Prevention:**
- Always verify package name before installing
- Check npm page for author and download count
- Review dependencies in package-lock.json

### Malicious Updates

**Attack:** Legitimate package gets compromised and malicious version published

**Prevention:**
- Use lock files (freezes versions)
- Review lock file changes in PRs
- Use `npm ci` or `pnpm install --frozen-lockfile` in CI
- Enable 2FA on npm account (for publishers)

### Compromised Maintainer Accounts

**Attack:** Attacker gains access to maintainer's npm account

**Prevention (for package publishers):**
```bash
# Enable 2FA on npm
npm profile enable-2fa auth-and-writes

# Check who has publish access
npm owner ls <package>

# Audit access tokens
npm token list
```

**Prevention (for package consumers):**
- Pin versions with lock files
- Monitor security advisories
- Use tools like Socket.dev or Snyk

## CI/CD Integration

### GitHub Actions

```yaml
name: Security Audit

on: [push, pull_request]

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      # npm
      - run: npm ci
      - run: npm audit --audit-level=high

      # pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm audit --audit-level=high

      # yarn
      - run: yarn install --frozen-lockfile
      - run: yarn audit
```

### GitLab CI

```yaml
security-audit:
  script:
    - npm ci
    - npm audit --audit-level=high
  only:
    - merge_requests
    - main
```

### Pre-commit Hooks

```bash
# Install husky
npm install --save-dev husky

# Add pre-commit hook
npx husky add .husky/pre-commit "npm audit --audit-level=high"
```

**Or use lint-staged:**
```json
{
  "lint-staged": {
    "package.json": [
      "npm audit --audit-level=high"
    ]
  }
}
```

## Best Practices

### DO

✅ **Commit lock files** to version control
✅ **Use `npm ci`** or frozen lockfile in CI/CD
✅ **Run security audits** regularly (weekly or on every PR)
✅ **Review dependency updates** before merging
✅ **Enable 2FA** on npm account (if publishing)
✅ **Use environment variables** for secrets
✅ **Scope private packages** (@yourcompany/package)
✅ **Check package reputation** before installing (downloads, maintainers, GitHub stars)
✅ **Pin versions** for critical dependencies
✅ **Update dependencies** regularly (monthly)
✅ **Use Dependabot** or Renovate for automated updates

### DON'T

❌ **Never commit secrets** (.env, API keys, passwords)
❌ **Never use `*` or `latest`** in dependencies
❌ **Never install with `sudo`** (use nvm/fnm instead)
❌ **Never skip lock file** review in PRs
❌ **Never use `npm install` in CI** (use npm ci)
❌ **Never ignore audit warnings** (investigate all findings)
❌ **Never copy node_modules** between projects (reinstall from lock file)
❌ **Never delete lock file** without good reason
❌ **Never use --force** without understanding the risk
❌ **Never ignore breaking changes** (read changelogs before updating)

### Automated Tools

**Dependabot (GitHub):**
- Automatically creates PRs for dependency updates
- Includes security updates
- Free for GitHub repos

**Renovate:**
- More configurable than Dependabot
- Supports multiple platforms (GitHub, GitLab, Bitbucket)
- Grouped updates, scheduling

**Snyk:**
- Continuous security monitoring
- Dependency scanning
- License compliance

**Socket.dev:**
- Supply chain security
- Detects malicious packages
- Monitors for typosquatting

**npm audit in CI:**
```bash
# Fail build if vulnerabilities found
npm audit --audit-level=high || exit 1
```

### Incident Response

**If you find a vulnerability:**

1. **Check severity** (npm audit or security advisory)
2. **Update affected package:**
   ```bash
   npm update <package>
   # or
   npm install <package>@latest
   ```
3. **Test thoroughly** (vulnerability fixes can introduce breaking changes)
4. **Commit and deploy** immediately if critical
5. **Review lock file changes** to confirm fix
6. **Document in changelog** what was fixed

**If no fix available:**
- Check for alternative packages
- Fork and patch yourself (temporary)
- Contact maintainer (GitHub issue)
- Consider removing dependency

### Regular Maintenance Schedule

**Weekly:**
- Run `npm audit` and review findings
- Check for critical security updates

**Monthly:**
- Run `npm outdated` and review packages
- Update minor/patch versions
- Review and merge Dependabot/Renovate PRs

**Quarterly:**
- Consider major version updates
- Remove unused dependencies
- Audit dev tools and build pipeline
