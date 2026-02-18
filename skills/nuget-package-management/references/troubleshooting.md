# Troubleshooting Guide

Common NuGet package management issues and their solutions.

## Table of Contents

- [Common Issues](#common-issues)
- [Version Conflicts](#version-conflicts)
- [CPM Issues](#cpm-issues)
- [Lock File Issues](#lock-file-issues)
- [Authentication Failures](#authentication-failures)
- [Debugging Commands](#debugging-commands)

## Common Issues

### "Package not found" Errors

**Symptom:** Package restore fails with "Package 'X' not found"

**Solutions:**

```bash
# 1. Clear NuGet caches
dotnet nuget locals all --clear

# 2. Restore with detailed logging
dotnet restore --verbosity detailed

# 3. Check package sources
dotnet nuget list source

# 4. Verify package exists on source
dotnet nuget list package PackageName --source nuget.org
```

**Common causes:**
- Typo in package name
- Package only available on private feed
- Source is disabled
- Network/firewall issues

### Restore is Very Slow

**Solutions:**

```bash
# Use parallel restore (default, but can adjust)
dotnet restore --disable-parallel  # If parallel causes issues

# Use local cache
dotnet restore --prefer-offline

# Check which source is slow
dotnet restore --verbosity normal
```

**Optimization tips:**
- Use private NuGet feed/cache near your location
- Disable unused package sources
- Use `--locked-mode` in CI (skips resolution)

### Build Succeeds Locally but Fails in CI

**Cause:** CI uses different package versions than your local machine

**Solution:**

```bash
# Enable lock files to freeze versions
# In Directory.Build.props or .csproj:
```
```xml
<PropertyGroup>
  <RestorePackagesWithLockFile>true</RestorePackagesWithLockFile>
</PropertyGroup>
```

```bash
# CI should use locked mode
dotnet restore --locked-mode
dotnet build --no-restore
```

### Package Downgrade Warnings

**Symptom:** "Detected package downgrade: Package X from 2.0.0 to 1.0.0"

**Cause:** Transitive dependency conflict

**Find the conflict:**
```bash
# Show complete dependency tree
dotnet list package --include-transitive

# Search for specific package
dotnet list package --include-transitive | grep PackageName
```

**Solution:**
```xml
<!-- Force specific version in .csproj or Directory.Packages.props -->
<PackageReference Include="Problematic.Package" Version="2.0.0" />
```

## Version Conflicts

### Multiple Versions of Same Package

**Symptom:** Build warnings about multiple versions

**Diagnose:**
```bash
# List all packages with versions
dotnet list package --include-transitive

# Export to JSON for analysis
dotnet list package --include-transitive --format json > deps.json

# Search for specific package
dotnet list package --include-transitive | grep PackageName
```

**Solution 1: Update direct references**
```bash
# Update to latest
dotnet add package Problematic.Package --version 2.0.0
```

**Solution 2: Use CPM to force single version**
```xml
<!-- Directory.Packages.props -->
<ItemGroup>
  <PackageVersion Include="Problematic.Package" Version="2.0.0" />
</ItemGroup>
```

**Solution 3: Override in specific project**
```xml
<!-- .csproj -->
<ItemGroup>
  <PackageReference Include="Problematic.Package" Version="2.0.0" />
</ItemGroup>
```

## CPM Issues

### CPM Not Working

**Symptom:** Versions not being picked up from Directory.Packages.props

**Check .NET SDK version:**
```bash
dotnet --version
# Need 6.0.300 or higher
```

**Verify CPM is enabled:**
```bash
# Check Directory.Packages.props exists
ls Directory.Packages.props

# Check ManagePackageVersionsCentrally is set
grep "ManagePackageVersionsCentrally" Directory.Packages.props
```

**Check for conflicting inline versions:**
```bash
# Should return nothing if CPM is properly configured
grep -r "PackageReference.*Version=" --include="*.csproj" .
```

**Solution:**
```bash
# Remove inline versions from .csproj files
find . -name "*.csproj" -exec sed -i '' 's/ Version="[^"]*"//g' {} \;

# Then restore
dotnet restore
```

### Mixing CPM and Inline Versions

**Symptom:** Some packages use CPM, others don't

**Diagnose:**
```bash
# Find inline versions
grep -r "PackageReference.*Version=" --include="*.csproj" .
```

**Solution:** Pick one approach:

**Option 1: Full CPM**
```bash
# Remove all inline versions
find . -name "*.csproj" -exec sed -i '' 's/ Version="[^"]*"//g' {} \;

# Add versions to Directory.Packages.props
```

**Option 2: No CPM**
```bash
# Remove Directory.Packages.props
rm Directory.Packages.props

# Add versions back to .csproj files
```

### Package Version Not Found in CPM

**Symptom:** Package reference in .csproj but no version in Directory.Packages.props

**Solution:**
```xml
<!-- Add missing version to Directory.Packages.props -->
<ItemGroup>
  <PackageVersion Include="MissingPackage" Version="1.0.0" />
</ItemGroup>
```

```bash
# Then restore
dotnet restore
```

## Lock File Issues

### Lock File Out of Sync

**Symptom:** "The lock file is not up-to-date"

**Solution:**
```bash
# Regenerate lock file
dotnet restore
```

**In CI (fail if out of sync):**
```bash
dotnet restore --locked-mode
```

### Delete and Regenerate Lock Files

```bash
# Delete all lock files
find . -name "packages.lock.json" -delete

# Regenerate
dotnet restore
```

### Lock File Merge Conflicts

**Symptom:** Git merge conflict in packages.lock.json

**Solution:**
```bash
# Accept either version
git checkout --ours packages.lock.json
# or
git checkout --theirs packages.lock.json

# Regenerate to resolve correctly
rm packages.lock.json
dotnet restore

# Commit resolved lock file
git add packages.lock.json
git commit
```

## Authentication Failures

### Private Feed Authentication Failed

**Symptom:** "Unable to load the service index" or "401 Unauthorized"

**Check credentials:**
```bash
# Verify environment variables are set
echo $AZURE_ARTIFACTS_USERNAME
echo $AZURE_ARTIFACTS_PAT

# List configured sources
dotnet nuget list source
```

**Solution:**
```bash
# Add or update source with credentials
dotnet nuget add source https://pkgs.dev.azure.com/org/_packaging/feed/nuget/v3/index.json \
  --name AzureArtifacts \
  --username az \
  --password $AZURE_ARTIFACTS_PAT \
  --store-password-in-clear-text
```

**Or use NuGet.config:**
```xml
<configuration>
  <packageSourceCredentials>
    <AzureArtifacts>
      <add key="Username" value="%AZURE_ARTIFACTS_USERNAME%" />
      <add key="ClearTextPassword" value="%AZURE_ARTIFACTS_PAT%" />
    </AzureArtifacts>
  </packageSourceCredentials>
</configuration>
```

### Credential Provider Issues

**For Azure Artifacts:**
```bash
# Install credential provider
dotnet tool install -g Azure.Artifacts.CredentialProvider

# Or use environment variable
export VSS_NUGET_EXTERNAL_FEED_ENDPOINTS='{"endpointCredentials": [{"endpoint":"https://pkgs.dev.azure.com/org/_packaging/feed/nuget/v3/index.json", "username":"anything", "password":"'$AZURE_ARTIFACTS_PAT'"}]}'
```

## Debugging Commands

### Check Package Metadata

```bash
# Show package info
dotnet nuget list package Serilog --source nuget.org

# Show all versions (requires nuget.exe)
nuget list Serilog -AllVersions

# Download package for inspection (doesn't install)
dotnet nuget download Serilog --version 3.1.1
```

### Check Dependency Tree

```bash
# Full dependency tree
dotnet list package --include-transitive

# Export to JSON
dotnet list package --include-transitive --format json > deps.json

# Search tree for specific package
dotnet list package --include-transitive | grep -A 5 "Serilog"
```

### MSBuild Diagnostics

```bash
# Show evaluated properties
dotnet msbuild -preprocess:evaluated.xml

# Show package references
dotnet msbuild -t:_CollectPackageReferences -p:Configuration=Debug

# Detailed build output
dotnet build --verbosity diagnostic > build.log

# Binary log (best for debugging)
dotnet build -bl:build.binlog
# Then open with MSBuild Structured Log Viewer
```

### Network Diagnostics

```bash
# Test connectivity to NuGet.org
curl -I https://api.nuget.org/v3/index.json

# Check if behind proxy
echo $HTTP_PROXY
echo $HTTPS_PROXY

# Test with verbose HTTP logging
dotnet restore --verbosity diagnostic 2>&1 | grep HTTP
```

## Clean Slate Approach

When all else fails, start fresh:

```bash
# 1. Clean build artifacts
dotnet clean

# 2. Clear all NuGet caches
dotnet nuget locals all --clear

# 3. Delete all lock files
find . -name "packages.lock.json" -delete

# 4. Delete bin and obj folders
find . -type d -name "bin" -o -name "obj" | xargs rm -rf

# 5. Restore from scratch
dotnet restore

# 6. Build
dotnet build
```

## Anti-Patterns That Cause Issues

### ❌ Manually Editing XML

**Problem:** Easy to create malformed XML or inconsistent state

**Solution:** Always use `dotnet` CLI commands

### ❌ Mixing Package Manager Commands

**Problem:** Using both `dotnet` and `nuget.exe` can cause conflicts

**Solution:** Stick to `dotnet` CLI for modern projects

### ❌ Not Committing Lock Files

**Problem:** Different versions in dev vs CI

**Solution:** Always commit `packages.lock.json`

### ❌ Ignoring Warnings

**Problem:** Warnings often indicate real issues

**Solution:** Treat warnings seriously, investigate and fix

### ❌ Using Very Old .NET SDK

**Problem:** Missing features like CPM, lock files

**Solution:** Use .NET 6.0.300+ for modern package management

## Getting Help

**When asking for help, provide:**

1. **dotnet --version** output
2. **Exact error message**
3. **Relevant .csproj or Directory.Packages.props**
4. **Output of `dotnet restore --verbosity detailed`**
5. **Output of `dotnet list package --include-transitive`**

**Useful logs:**
```bash
# Capture detailed restore log
dotnet restore --verbosity diagnostic > restore.log 2>&1

# Capture build log
dotnet build --verbosity diagnostic > build.log 2>&1

# Binary log (best for complex issues)
dotnet build -bl:build.binlog
```
