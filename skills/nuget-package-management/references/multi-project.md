# Multi-Project Solutions

Complete guide to managing NuGet packages in multi-project .NET solutions.

## Table of Contents

- [Solution Structure](#solution-structure)
- [Directory.Build.props Pattern](#directorybuildprops-pattern)
- [Solution-Wide Commands](#solution-wide-commands)
- [Shared Package References](#shared-package-references)
- [Project-Specific Packages](#project-specific-packages)

## Solution Structure

### Typical Multi-Project Layout

```
MySolution/
├── MySolution.sln                    # Solution file
├── Directory.Packages.props          # CPM versions (if using CPM)
├── Directory.Build.props             # Shared MSBuild properties
├── NuGet.config                      # Package sources
├── global.json                       # SDK version pinning
├── .gitignore
├── src/
│   ├── MySolution.Core/
│   │   ├── MySolution.Core.csproj
│   │   └── packages.lock.json
│   ├── MySolution.Api/
│   │   ├── MySolution.Api.csproj
│   │   └── packages.lock.json
│   └── MySolution.Worker/
│       ├── MySolution.Worker.csproj
│       └── packages.lock.json
└── tests/
    ├── MySolution.Core.Tests/
    │   ├── MySolution.Core.Tests.csproj
    │   └── packages.lock.json
    └── MySolution.Api.Tests/
        ├── MySolution.Api.Tests.csproj
        └── packages.lock.json
```

### Key Files

**MySolution.sln** - Solution file listing all projects
**Directory.Packages.props** - Centralized package versions (CPM)
**Directory.Build.props** - Shared MSBuild properties for all projects
**NuGet.config** - Package sources and credentials
**global.json** - Pins .NET SDK version for consistency

## Directory.Build.props Pattern

### What is Directory.Build.props?

A special MSBuild file that automatically applies properties to all projects in the directory tree.

**Benefits:**
- Share configuration across all projects
- Avoid repetition in .csproj files
- Enforce standards (analyzers, warnings, etc.)
- Centralize common package references

### Basic Directory.Build.props

**Create at solution root:**

```xml
<Project>
  <!-- Global properties for all projects -->
  <PropertyGroup>
    <LangVersion>latest</LangVersion>
    <Nullable>enable</Nullable>
    <TreatWarningsAsErrors>true</TreatWarningsAsErrors>
    <RestorePackagesWithLockFile>true</RestorePackagesWithLockFile>
  </PropertyGroup>

  <!-- Shared analyzers for all projects -->
  <ItemGroup>
    <PackageReference Include="Microsoft.CodeAnalysis.NetAnalyzers" PrivateAssets="All" />
    <PackageReference Include="StyleCop.Analyzers" PrivateAssets="All" />
  </ItemGroup>
</Project>
```

### Conditional Properties

**Apply settings based on project type:**

```xml
<Project>
  <!-- Test project specific settings -->
  <PropertyGroup Condition="$(MSBuildProjectName.EndsWith('.Tests'))">
    <IsPackable>false</IsPackable>
    <IsTestProject>true</IsTestProject>
  </PropertyGroup>

  <!-- API project specific settings -->
  <PropertyGroup Condition="$(MSBuildProjectName.EndsWith('.Api'))">
    <GenerateDocumentationFile>true</GenerateDocumentationFile>
  </PropertyGroup>

  <!-- Debug configuration -->
  <PropertyGroup Condition="'$(Configuration)' == 'Debug'">
    <DefineConstants>$(DefineConstants);DEBUG_LOGGING</DefineConstants>
  </PropertyGroup>
</Project>
```

### Shared Package References

**Add packages to all projects automatically:**

```xml
<Project>
  <!-- All projects get these analyzers -->
  <ItemGroup>
    <PackageReference Include="Microsoft.CodeAnalysis.NetAnalyzers" PrivateAssets="All" />
    <PackageReference Include="StyleCop.Analyzers" PrivateAssets="All" />
  </ItemGroup>

  <!-- All projects get logging -->
  <ItemGroup>
    <PackageReference Include="Serilog" />
    <PackageReference Include="Serilog.Sinks.Console" />
  </ItemGroup>

  <!-- Test projects get xUnit -->
  <ItemGroup Condition="$(MSBuildProjectName.EndsWith('.Tests'))">
    <PackageReference Include="xUnit" PrivateAssets="All" />
    <PackageReference Include="xUnit.runner.visualstudio" PrivateAssets="All" />
    <PackageReference Include="Moq" PrivateAssets="All" />
  </ItemGroup>
</Project>
```

### Directory.Build.props Hierarchy

**You can have multiple Directory.Build.props files:**

```
MySolution/
├── Directory.Build.props           # Applies to ALL projects
├── src/
│   ├── Directory.Build.props       # Applies to src projects only
│   ├── MySolution.Core/
│   └── MySolution.Api/
└── tests/
    ├── Directory.Build.props       # Applies to test projects only
    ├── MySolution.Core.Tests/
    └── MySolution.Api.Tests/
```

**Example - tests/Directory.Build.props:**
```xml
<Project>
  <!-- Import root props first -->
  <Import Project="$([MSBuild]::GetPathOfFileAbove('Directory.Build.props', '$(MSBuildThisFileDirectory)../'))" />

  <!-- Add test-specific settings -->
  <PropertyGroup>
    <IsPackable>false</IsPackable>
    <IsTestProject>true</IsTestProject>
  </PropertyGroup>

  <!-- Test frameworks -->
  <ItemGroup>
    <PackageReference Include="xUnit" />
    <PackageReference Include="xUnit.runner.visualstudio" />
    <PackageReference Include="coverlet.collector" />
  </ItemGroup>
</Project>
```

## Solution-Wide Commands

### List All Packages

```bash
# List packages in entire solution
dotnet list MySolution.sln package

# Include transitive dependencies
dotnet list MySolution.sln package --include-transitive

# Check outdated across all projects
dotnet list MySolution.sln package --outdated

# Check vulnerabilities across all projects
dotnet list MySolution.sln package --vulnerable --include-transitive
```

### Restore Entire Solution

```bash
# Restore all projects
dotnet restore MySolution.sln

# Restore with locked mode (CI/CD)
dotnet restore MySolution.sln --locked-mode
```

### Build and Test Solution

```bash
# Build entire solution
dotnet build MySolution.sln

# Run all tests
dotnet test MySolution.sln

# Build with no restore (CI/CD)
dotnet restore MySolution.sln --locked-mode
dotnet build MySolution.sln --no-restore
dotnet test MySolution.sln --no-build
```

## Shared Package References

### Using CPM for Shared Versions

**Directory.Packages.props:**
```xml
<Project>
  <PropertyGroup>
    <ManagePackageVersionsCentrally>true</ManagePackageVersionsCentrally>
  </PropertyGroup>

  <!-- Shared versions -->
  <PropertyGroup Label="SharedVersions">
    <MicrosoftExtensionsVersion>8.0.0</MicrosoftExtensionsVersion>
    <SerilogVersion>3.1.1</SerilogVersion>
  </PropertyGroup>

  <!-- Microsoft.Extensions family -->
  <ItemGroup Label="Microsoft.Extensions">
    <PackageVersion Include="Microsoft.Extensions.Logging" Version="$(MicrosoftExtensionsVersion)" />
    <PackageVersion Include="Microsoft.Extensions.Configuration" Version="$(MicrosoftExtensionsVersion)" />
    <PackageVersion Include="Microsoft.Extensions.DependencyInjection" Version="$(MicrosoftExtensionsVersion)" />
  </ItemGroup>

  <!-- Logging -->
  <ItemGroup Label="Serilog">
    <PackageVersion Include="Serilog" Version="$(SerilogVersion)" />
    <PackageVersion Include="Serilog.Sinks.Console" Version="$(SerilogVersion)" />
    <PackageVersion Include="Serilog.Sinks.File" Version="$(SerilogVersion)" />
  </ItemGroup>
</Project>
```

### Projects Reference Without Versions

**MyProject.csproj:**
```xml
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net8.0</TargetFramework>
  </PropertyGroup>

  <ItemGroup>
    <!-- Versions come from Directory.Packages.props -->
    <PackageReference Include="Microsoft.Extensions.Logging" />
    <PackageReference Include="Serilog" />
  </ItemGroup>
</Project>
```

## Project-Specific Packages

### Add Package to Specific Project

```bash
# From solution root
dotnet add src/MySolution.Api/MySolution.Api.csproj package Swashbuckle.AspNetCore

# From project directory
cd src/MySolution.Api
dotnet add package Swashbuckle.AspNetCore
```

### Conditional Package References

**Only include packages when needed:**

```xml
<ItemGroup>
  <!-- Only for API projects -->
  <PackageReference Include="Swashbuckle.AspNetCore" Condition="$(MSBuildProjectName.EndsWith('.Api'))" />

  <!-- Only for Windows -->
  <PackageReference Include="Microsoft.Windows.SDK.Contracts" Condition="'$(OS)' == 'Windows_NT'" />

  <!-- Only for Debug builds -->
  <PackageReference Include="BenchmarkDotNet" Condition="'$(Configuration)' == 'Debug'" />

  <!-- Only for .NET 6.0 target -->
  <PackageReference Include="System.Text.Json" Condition="'$(TargetFramework)' == 'net6.0'" />
</ItemGroup>
```

### Version Overrides for Specific Projects

**Override CPM version for one project:**

```xml
<!-- In specific project only -->
<ItemGroup>
  <!-- This project needs older version -->
  <PackageReference Include="Newtonsoft.Json" VersionOverride="12.0.3" />
</ItemGroup>
```

**When to use:**
- Legacy code requires older version
- Testing compatibility
- Temporary workaround

**Warning:** Document why override is needed. Remove when possible.

## Best Practices

### DO

✅ **Use Directory.Build.props** for shared configuration
✅ **Use CPM** for multi-project solutions
✅ **Enable lock files** in Directory.Build.props
✅ **Group related packages** with labels
✅ **Use shared version variables** for package families
✅ **Run solution-wide checks** (`dotnet list MySolution.sln package --vulnerable`)
✅ **Organize projects** into src/ and tests/ directories
✅ **Commit NuGet.config** (without secrets)

### DON'T

❌ **Don't repeat configuration** in every .csproj (use Directory.Build.props)
❌ **Don't mix CPM and inline versions** (pick one approach)
❌ **Don't skip lock files** in production applications
❌ **Don't version test projects** (set `<IsPackable>false</IsPackable>`)
❌ **Don't commit packages** to git (use lock files for reproducibility)
❌ **Don't ignore transitive dependencies** in vulnerability checks

## Example: Complete Solution Setup

**Directory.Build.props:**
```xml
<Project>
  <!-- Global settings -->
  <PropertyGroup>
    <LangVersion>latest</LangVersion>
    <Nullable>enable</Nullable>
    <TreatWarningsAsErrors>true</TreatWarningsAsErrors>
    <RestorePackagesWithLockFile>true</RestorePackagesWithLockFile>
  </PropertyGroup>

  <!-- Test project detection -->
  <PropertyGroup Condition="$(MSBuildProjectName.EndsWith('.Tests'))">
    <IsPackable>false</IsPackable>
    <IsTestProject>true</IsTestProject>
  </PropertyGroup>

  <!-- Shared analyzers -->
  <ItemGroup>
    <PackageReference Include="Microsoft.CodeAnalysis.NetAnalyzers" PrivateAssets="All" />
  </ItemGroup>
</Project>
```

**Directory.Packages.props:**
```xml
<Project>
  <PropertyGroup>
    <ManagePackageVersionsCentrally>true</ManagePackageVersionsCentrally>
  </PropertyGroup>

  <PropertyGroup Label="SharedVersions">
    <SerilogVersion>3.1.1</SerilogVersion>
  </PropertyGroup>

  <ItemGroup Label="Logging">
    <PackageVersion Include="Serilog" Version="$(SerilogVersion)" />
    <PackageVersion Include="Serilog.Sinks.Console" Version="$(SerilogVersion)" />
  </ItemGroup>
</Project>
```

**Result:** All projects automatically get:
- C# latest language version
- Nullable reference types enabled
- Warnings as errors
- Package lock files
- Code analyzers
- Serilog logging (if they reference it)
