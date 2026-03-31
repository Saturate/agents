# dotnet CLI Commands

Complete command reference for NuGet package management using dotnet CLI.

## Table of Contents

- [Package Operations](#package-operations)
- [CPM-Specific Commands](#cpm-specific-commands)
- [Solution-Wide Operations](#solution-wide-operations)
- [Package Sources](#package-sources)
- [NuGet.config Management](#nugetconfig-management)
- [Version Management](#version-management)
- [Prerelease Packages](#prerelease-packages)

## Package Operations

| Task | Command |
|------|---------|
| Add package | `dotnet add package <Name>` |
| Add specific version | `dotnet add package <Name> --version <Version>` |
| Remove package | `dotnet remove package <Name>` |
| List packages | `dotnet list package` |
| List transitive | `dotnet list package --include-transitive` |
| List outdated | `dotnet list package --outdated` |
| List vulnerable | `dotnet list package --vulnerable` |
| Restore packages | `dotnet restore` |
| Clean packages | `dotnet nuget locals all --clear` |

### Add Package

```bash
# Add latest version
dotnet add package Newtonsoft.Json

# Add specific version
dotnet add package Newtonsoft.Json --version 13.0.3

# Add to specific project
dotnet add src/MyProject/MyProject.csproj package Serilog

# Add prerelease
dotnet add package Akka --prerelease
```

### Remove Package

```bash
# Remove from current project
dotnet remove package Newtonsoft.Json

# Remove from specific project
dotnet remove src/MyProject/MyProject.csproj package Serilog
```

### List Packages

```bash
# List packages in current project
dotnet list package

# Include transitive dependencies
dotnet list package --include-transitive

# Check for outdated packages
dotnet list package --outdated

# Check for vulnerable packages
dotnet list package --vulnerable

# Combine flags
dotnet list package --vulnerable --include-transitive
```

### Restore Packages

```bash
# Restore current project
dotnet restore

# Restore specific project
dotnet restore src/MyProject/MyProject.csproj

# Restore with locked mode (CI)
dotnet restore --locked-mode

# Verbose output for troubleshooting
dotnet restore --verbosity detailed
```

### Clear Cache

```bash
# Clear all NuGet caches
dotnet nuget locals all --clear

# Clear specific cache
dotnet nuget locals http-cache --clear
dotnet nuget locals global-packages --clear
dotnet nuget locals temp --clear
```

## CPM-Specific Commands

When Central Package Management is enabled:

### Add Package (CPM)

```bash
# Add package reference without version
dotnet add package Newtonsoft.Json

# The version must be added to Directory.Packages.props manually:
# <PackageVersion Include="Newtonsoft.Json" Version="13.0.3" />

# Then restore
dotnet restore
```

### Remove Package (CPM)

```bash
# Remove from project
dotnet remove package Newtonsoft.Json

# Version stays in Directory.Packages.props
# Clean up Directory.Packages.props manually if no longer needed
```

### Check CPM Status

```bash
# Verify CPM is enabled
grep "ManagePackageVersionsCentrally" Directory.Packages.props

# Check for inline versions (should be empty with CPM)
grep -r "PackageReference.*Version=" --include="*.csproj" .
```

## Solution-Wide Operations

### List Packages Across Solution

```bash
# List packages in entire solution
dotnet list MySolution.sln package

# List outdated in all projects
dotnet list MySolution.sln package --outdated

# Check vulnerabilities across solution
dotnet list MySolution.sln package --vulnerable --include-transitive

# Include transitive dependencies
dotnet list MySolution.sln package --include-transitive
```

### Restore Solution

```bash
# Restore entire solution
dotnet restore MySolution.sln

# Restore with locked mode
dotnet restore MySolution.sln --locked-mode
```

## Package Sources

### List Sources

```bash
# List all configured sources
dotnet nuget list source

# Shows: Name, URL, Enabled status
```

### Add Source

```bash
# Add public source
dotnet nuget add source https://api.nuget.org/v3/index.json --name NuGetOrg

# Add private source (Azure Artifacts)
dotnet nuget add source \
  https://pkgs.dev.azure.com/myorg/_packaging/myfeed/nuget/v3/index.json \
  --name AzureArtifacts \
  --username az \
  --password $AZURE_ARTIFACTS_PAT \
  --store-password-in-clear-text
```

### Remove Source

```bash
dotnet nuget remove source AzureArtifacts
```

### Update Source

```bash
# Update source URL
dotnet nuget update source AzureArtifacts \
  --source https://new-url.com/nuget/v3/index.json

# Update credentials
dotnet nuget update source AzureArtifacts \
  --username newuser \
  --password $NEW_PAT \
  --store-password-in-clear-text
```

### Enable/Disable Source

```bash
# Disable source temporarily
dotnet nuget disable source AzureArtifacts

# Re-enable source
dotnet nuget enable source AzureArtifacts
```

## NuGet.config Management

### Solution-Level NuGet.config

Create at solution root:

```xml
<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <packageSources>
    <clear />
    <add key="nuget.org" value="https://api.nuget.org/v3/index.json" />
    <add key="AzureArtifacts" value="https://pkgs.dev.azure.com/myorg/_packaging/myfeed/nuget/v3/index.json" />
  </packageSources>

  <packageSourceCredentials>
    <AzureArtifacts>
      <add key="Username" value="%AZURE_ARTIFACTS_USERNAME%" />
      <add key="ClearTextPassword" value="%AZURE_ARTIFACTS_PAT%" />
    </AzureArtifacts>
  </packageSourceCredentials>
</configuration>
```

**Best practices:**
- Use environment variables for credentials (never commit secrets)
- `<clear />` ensures only your sources are used
- Put NuGet.config at solution root
- Commit to git (without secrets)

## Version Management

### Check Outdated Packages

```bash
# List all outdated packages
dotnet list package --outdated

# Include prerelease versions
dotnet list package --outdated --include-prerelease

# Check highest patch/minor/major available
dotnet list package --outdated --highest-patch
dotnet list package --outdated --highest-minor
dotnet list package --outdated --highest-major
```

### Update Packages

**Without CPM:**
```bash
# Update to latest patch (1.2.3 → 1.2.5)
dotnet add package Serilog --version 3.1.1

# Update to latest minor (1.2.3 → 1.5.0)
dotnet add package Serilog --version 3.5.0

# Update to latest major (1.2.3 → 2.0.0)
dotnet add package Serilog --version 4.0.0
```

**With CPM:**
```xml
<!-- Edit Directory.Packages.props -->
<!-- Before -->
<PackageVersion Include="Serilog" Version="3.0.1" />

<!-- After -->
<PackageVersion Include="Serilog" Version="3.1.1" />
```

Then restore:
```bash
dotnet restore
```

## Prerelease Packages

### Add Prerelease

```bash
# Add latest prerelease version
dotnet add package Akka --prerelease

# Add specific prerelease version
dotnet add package Akka --version 1.6.0-beta1
```

### Check Prerelease Updates

```bash
# Include prerelease in outdated check
dotnet list package --outdated --include-prerelease
```

### Search for Prereleases

```bash
# List all versions including prerelease (using nuget CLI)
nuget list Akka -AllVersions -PreRelease
```

## Debugging Commands

### Check Package Metadata

```bash
# Show package info from NuGet.org
dotnet nuget list package Serilog --source nuget.org

# Show all available versions (using nuget CLI)
nuget list Serilog -AllVersions

# Download package for inspection (doesn't install)
dotnet nuget download Serilog --version 3.1.1
```

### Check Dependency Tree

```bash
# Show complete dependency tree
dotnet list package --include-transitive

# Search for specific package in tree
dotnet list package --include-transitive | grep Serilog

# Export to JSON for analysis
dotnet list package --include-transitive --format json > packages.json
```

### MSBuild Diagnostics

```bash
# Show evaluated properties
dotnet msbuild -preprocess:evaluated.xml

# Show package references
dotnet msbuild -t:_CollectPackageReferences -p:Configuration=Debug

# Detailed build output
dotnet build --verbosity diagnostic > build.log
```

## CI/CD Commands

### Locked Restore (Reproducible Builds)

```bash
# Fail if packages.lock.json doesn't match
dotnet restore --locked-mode

# Use in CI/CD pipelines for reproducibility
```

### Vulnerability Scanning

```bash
# Check for vulnerabilities (exit non-zero if found)
dotnet list package --vulnerable --include-transitive || exit 1

# JSON output for parsing
dotnet list package --vulnerable --include-transitive --format json
```

### Build with Restore

```bash
# Restore and build in one command
dotnet build

# Explicit restore first (recommended for CI)
dotnet restore --locked-mode
dotnet build --no-restore
```
