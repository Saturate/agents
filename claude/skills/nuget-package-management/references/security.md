# Security Best Practices

Complete guide to securing your NuGet dependencies.

## Table of Contents

- [Vulnerability Scanning](#vulnerability-scanning)
- [Package Lock Files](#package-lock-files)
- [Trusted Signers](#trusted-signers)
- [CI/CD Integration](#cicd-integration)
- [Security Anti-Patterns](#security-anti-patterns)

## Vulnerability Scanning

### Check for Vulnerabilities

```bash
# Check current project
dotnet list package --vulnerable

# Include transitive dependencies (recommended)
dotnet list package --vulnerable --include-transitive

# Check entire solution
dotnet list MySolution.sln package --vulnerable --include-transitive

# Output as JSON for CI/CD
dotnet list package --vulnerable --include-transitive --format json
```

### Understanding Vulnerability Output

```
Project 'MyProject' has the following vulnerable packages
   [net8.0]:
   Top-level Package      Requested   Resolved   Severity   Advisory URL
   > System.Text.Json     7.0.0       7.0.0      High       https://github.com/advisories/GHSA-...

   Transitive Package           Resolved   Severity   Advisory URL
   > System.Text.Encodings.Web  7.0.0      High       https://github.com/advisories/GHSA-...
```

**Action items:**
1. Update vulnerable packages immediately
2. Check advisory URL for details
3. Verify fix is available
4. Test after updating

### Severity Levels

| Severity | Action Required |
|----------|----------------|
| Critical | Update immediately, block deployment |
| High | Update within 24 hours |
| Moderate | Update within 1 week |
| Low | Update during regular maintenance |

## Package Lock Files

### Enable Lock Files

**In .csproj or Directory.Build.props:**
```xml
<PropertyGroup>
  <RestorePackagesWithLockFile>true</RestorePackagesWithLockFile>
  <DisableImplicitNuGetFallbackFolder>true</DisableImplicitNuGetFallbackFolder>
</PropertyGroup>
```

### Generate Lock File

```bash
# Generate packages.lock.json
dotnet restore

# Lock file created at project root
ls packages.lock.json
```

### CI/CD with Locked Restore

```bash
# Fail if lock file doesn't match packages
dotnet restore --locked-mode

# Use in CI/CD for reproducible builds
```

### When to Use Lock Files

| Project Type | Use Lock Files? | Why |
|--------------|----------------|-----|
| Applications | ✅ Yes | Ensures exact versions in production |
| CI/CD Pipelines | ✅ Yes | Reproducible builds |
| Libraries | ⚠️ Optional | Helps contributors, but flexible for consumers |
| Tools/CLI | ✅ Yes | Consistent behavior |

### Lock File Structure

```json
{
  "version": 1,
  "dependencies": {
    "net8.0": {
      "Newtonsoft.Json": {
        "type": "Direct",
        "requested": "[13.0.3, )",
        "resolved": "13.0.3",
        "contentHash": "..."
      },
      "System.Text.Json": {
        "type": "Transitive",
        "resolved": "8.0.0",
        "contentHash": "..."
      }
    }
  }
}
```

**Key fields:**
- `type`: Direct (your dependencies) vs Transitive (dependencies of dependencies)
- `requested`: Version range you specified
- `resolved`: Actual version resolved
- `contentHash`: SHA-512 hash for integrity verification

### Lock File Benefits

✅ **Reproducible builds** - Same versions across all environments
✅ **Security** - Detects tampered packages via content hash
✅ **Audit trail** - Track exact dependency versions over time
✅ **Supply chain protection** - Prevents dependency confusion attacks

## Trusted Signers

### Require Package Signatures

**In NuGet.config:**
```xml
<configuration>
  <trustedSigners>
    <author name="Microsoft">
      <certificate fingerprint="3F9001EA83C560D712C24CF213C3D312CB3BFF51EE89435D3430BD06B5D0EECE"
                   hashAlgorithm="SHA256"
                   allowUntrustedRoot="false" />
    </author>
    <repository name="nuget.org" serviceIndex="https://api.nuget.org/v3/index.json">
      <certificate fingerprint="0E5F38F57DC1BCC806D8494F4F90FBCEDD988B46760709CBEEC6F4219AA6157D"
                   hashAlgorithm="SHA256"
                   allowUntrustedRoot="false" />
    </repository>
  </trustedSigners>
</configuration>
```

### Add Trusted Signer

```bash
# Trust author signature
dotnet nuget trust author Microsoft --certificate-fingerprint 3F9001EA...

# Trust repository
dotnet nuget trust repository nuget.org --service-index https://api.nuget.org/v3/index.json
```

### List Trusted Signers

```bash
# Show all trusted signers
dotnet nuget list trust
```

### Why Package Signatures Matter

- **Authentication** - Verify package is from claimed publisher
- **Integrity** - Detect tampering during download
- **Non-repudiation** - Publisher can't deny publishing
- **Trust chain** - Build on established certificate authorities

## CI/CD Integration

### GitHub Actions

```yaml
name: Security Audit

on: [push, pull_request]

jobs:
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup .NET
        uses: actions/setup-dotnet@v4
        with:
          dotnet-version: '8.0.x'

      - name: Restore with locked mode
        run: dotnet restore --locked-mode

      - name: Check for vulnerable packages
        run: |
          output=$(dotnet list package --vulnerable --include-transitive)
          if echo "$output" | grep -q "has the following vulnerable packages"; then
            echo "::error::Vulnerable packages found"
            echo "$output"
            exit 1
          fi

      - name: Check for outdated packages
        run: dotnet list package --outdated
```

### Azure Pipelines

```yaml
- task: DotNetCoreCLI@2
  displayName: 'Restore packages (locked mode)'
  inputs:
    command: 'restore'
    arguments: '--locked-mode'

- task: DotNetCoreCLI@2
  displayName: 'Check vulnerabilities'
  inputs:
    command: 'custom'
    custom: 'list'
    arguments: 'package --vulnerable --include-transitive'
  continueOnError: false
```

### GitLab CI

```yaml
security-scan:
  script:
    - dotnet restore --locked-mode
    - dotnet list package --vulnerable --include-transitive || exit 1
  only:
    - merge_requests
    - main
```

## Security Anti-Patterns

### ❌ Not Checking for Vulnerabilities

**Bad:**
```bash
# Just install and hope for the best
dotnet add package OldPackage
```

**Good:**
```bash
# Check for vulnerabilities first
dotnet list package --vulnerable --include-transitive

# Then update vulnerable packages
dotnet add package OldPackage --version 2.0.0  # fixed version
```

### ❌ Ignoring Transitive Dependencies

**Bad:**
```bash
# Only check direct dependencies
dotnet list package --vulnerable
```

**Good:**
```bash
# Always include transitive dependencies
dotnet list package --vulnerable --include-transitive
```

**Why:** 80% of vulnerabilities are in transitive dependencies.

### ❌ Not Using Lock Files in Production

**Bad:**
```xml
<!-- No lock file configuration -->
```

**Good:**
```xml
<PropertyGroup>
  <RestorePackagesWithLockFile>true</RestorePackagesWithLockFile>
  <DisableImplicitNuGetFallbackFolder>true</DisableImplicitNuGetFallbackFolder>
</PropertyGroup>
```

### ❌ Committing Credentials to Git

**Bad:**
```xml
<!-- NuGet.config -->
<packageSourceCredentials>
  <AzureArtifacts>
    <add key="Username" value="myusername" />
    <add key="ClearTextPassword" value="my-secret-password" />
  </AzureArtifacts>
</packageSourceCredentials>
```

**Good:**
```xml
<!-- NuGet.config -->
<packageSourceCredentials>
  <AzureArtifacts>
    <add key="Username" value="%AZURE_ARTIFACTS_USERNAME%" />
    <add key="ClearTextPassword" value="%AZURE_ARTIFACTS_PAT%" />
  </AzureArtifacts>
</packageSourceCredentials>
```

Use environment variables, never hardcode credentials.

### ❌ Using Wildcard Versions

**Bad:**
```xml
<PackageVersion Include="Newtonsoft.Json" Version="*" />
```

**Good:**
```xml
<PackageVersion Include="Newtonsoft.Json" Version="13.0.3" />
```

Wildcard versions can pull in vulnerable versions unexpectedly.

### ❌ Skipping Lock Mode in CI

**Bad:**
```bash
# CI/CD pipeline
dotnet restore
dotnet build
```

**Good:**
```bash
# CI/CD pipeline
dotnet restore --locked-mode  # Fail if lock file outdated
dotnet build --no-restore
```

## Best Practices Summary

✅ **Enable lock files** for all applications
✅ **Run vulnerability scans** on every PR and commit
✅ **Use locked-mode restore** in CI/CD
✅ **Include transitive dependencies** in vulnerability checks
✅ **Update vulnerabilities** within severity timeframes
✅ **Use environment variables** for credentials
✅ **Trust package signatures** when possible
✅ **Monitor outdated packages** regularly
✅ **Use exact versions** (avoid wildcards)
✅ **Commit lock files** to version control

## Regular Maintenance Schedule

**Daily/Per PR:**
- Run `dotnet list package --vulnerable --include-transitive`
- Block merges if vulnerabilities found

**Weekly:**
- Check for outdated packages: `dotnet list package --outdated`
- Update patch versions

**Monthly:**
- Review all dependencies
- Update minor versions
- Remove unused packages

**Quarterly:**
- Consider major version updates
- Audit dependency tree
- Review security configurations
