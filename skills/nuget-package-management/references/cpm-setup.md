# Central Package Management (CPM) Setup

Complete guide to setting up and using Central Package Management for .NET projects.

## Table of Contents

- [What is CPM?](#what-is-cpm)
- [Setup Requirements](#setup-requirements)
- [Enable CPM](#enable-cpm)
- [Shared Version Variables](#shared-version-variables)
- [Common Patterns](#common-patterns)
- [Version Overrides](#version-overrides)
- [When to Use CPM](#when-to-use-cpm)
- [When NOT to Use CPM](#when-not-to-use-cpm)

## What is CPM?

CPM centralizes all package versions in a single `Directory.Packages.props` file at the solution root, eliminating version conflicts across multiple projects.

**Benefits:**
- Single source of truth for all package versions
- No version conflicts between projects
- Easier to update related packages together
- Clear visibility of all dependencies

## Setup Requirements

- **.NET SDK**: 6.0.300+ required
- **NuGet**: 6.2+ required
- **Visual Studio**: 2022 17.2+ for full IDE support

**Check your version:**
```bash
dotnet --version  # Must be 6.0.300 or higher
```

## Enable CPM

### Step 1: Create Directory.Packages.props

Create at solution root (next to .sln file):

```xml
<Project>
  <PropertyGroup>
    <ManagePackageVersionsCentrally>true</ManagePackageVersionsCentrally>
  </PropertyGroup>

  <ItemGroup>
    <PackageVersion Include="Newtonsoft.Json" Version="13.0.3" />
    <PackageVersion Include="Serilog" Version="3.1.1" />
  </ItemGroup>
</Project>
```

### Step 2: Update Project Files

Project files reference packages **WITHOUT versions**:

```xml
<Project Sdk="Microsoft.NET.Sdk">
  <ItemGroup>
    <PackageReference Include="Newtonsoft.Json" />
    <PackageReference Include="Serilog" />
  </ItemGroup>
</Project>
```

### Step 3: Verify CPM is Working

```bash
# This should show centralized versions
dotnet list package

# Check for inline versions (should be empty)
grep -r "PackageReference.*Version=" --include="*.csproj" .
```

## Shared Version Variables

Organize related packages using MSBuild properties to reduce maintenance:

```xml
<Project>
  <PropertyGroup>
    <ManagePackageVersionsCentrally>true</ManagePackageVersionsCentrally>
  </PropertyGroup>

  <PropertyGroup Label="SharedVersions">
    <AkkaVersion>1.5.59</AkkaVersion>
    <MicrosoftExtensionsVersion>8.0.0</MicrosoftExtensionsVersion>
    <EFCoreVersion>8.0.10</EFCoreVersion>
  </PropertyGroup>

  <ItemGroup Label="Akka.NET">
    <PackageVersion Include="Akka" Version="$(AkkaVersion)" />
    <PackageVersion Include="Akka.Cluster" Version="$(AkkaVersion)" />
    <PackageVersion Include="Akka.Persistence" Version="$(AkkaVersion)" />
  </ItemGroup>

  <ItemGroup Label="Microsoft.Extensions">
    <PackageVersion Include="Microsoft.Extensions.Logging" Version="$(MicrosoftExtensionsVersion)" />
    <PackageVersion Include="Microsoft.Extensions.Configuration" Version="$(MicrosoftExtensionsVersion)" />
    <PackageVersion Include="Microsoft.Extensions.DependencyInjection" Version="$(MicrosoftExtensionsVersion)" />
  </ItemGroup>

  <ItemGroup Label="Entity Framework Core">
    <PackageVersion Include="Microsoft.EntityFrameworkCore" Version="$(EFCoreVersion)" />
    <PackageVersion Include="Microsoft.EntityFrameworkCore.SqlServer" Version="$(EFCoreVersion)" />
    <PackageVersion Include="Microsoft.EntityFrameworkCore.Tools" Version="$(EFCoreVersion)" />
  </ItemGroup>
</Project>
```

**Benefits:**
- Update all Akka packages by changing one variable
- Ensures version consistency across related packages
- Clear organization by package family

## Common Patterns

### Development-Only Packages

Use `PrivateAssets="All"` to prevent packages from flowing to consumers:

```xml
<ItemGroup>
  <!-- Build/analyzer tools -->
  <PackageReference Include="Microsoft.CodeAnalysis.NetAnalyzers" PrivateAssets="All" />
  <PackageReference Include="StyleCop.Analyzers" PrivateAssets="All" />

  <!-- Test frameworks -->
  <PackageReference Include="xUnit" PrivateAssets="All" />
  <PackageReference Include="Moq" PrivateAssets="All" />
</ItemGroup>
```

**Why this matters:**
- Consumers don't get dev dependencies
- Cleaner dependency graphs
- Smaller package sizes

### Conditional Package References

```xml
<ItemGroup>
  <!-- Only for Debug builds -->
  <PackageReference Include="BenchmarkDotNet" Condition="'$(Configuration)' == 'Debug'" />

  <!-- Only for specific target frameworks -->
  <PackageReference Include="System.Text.Json" Condition="'$(TargetFramework)' == 'net6.0'" />

  <!-- Only on Windows -->
  <PackageReference Include="Microsoft.Windows.SDK.Contracts" Condition="'$(OS)' == 'Windows_NT'" />
</ItemGroup>
```

## Version Overrides

**Use sparingly to override CPM for specific projects:**

```xml
<!-- In specific project, not Directory.Packages.props -->
<ItemGroup>
  <!-- Override centralized version for this project only -->
  <PackageReference Include="Newtonsoft.Json" VersionOverride="12.0.3" />
</ItemGroup>
```

**When to use:**
- Legacy project requires older version
- Testing compatibility with different versions
- Temporary workaround for breaking changes

**Warning:** Overrides defeat CPM purpose. Use only when necessary and document why.

## When to Use CPM

**Use CPM when:**
- ✅ Multi-project solution (most common use case)
- ✅ Need version consistency across projects
- ✅ Managing many related packages (e.g., ASP.NET Core, EF Core)
- ✅ .NET SDK 6.0.300+ or later
- ✅ Active development with frequent updates

**Benefits for multi-project solutions:**
- Single update point for all projects
- Impossible to have version conflicts
- Clear dependency overview
- Easier code reviews (one file to check)

## When NOT to Use CPM

### Single Project Solutions

**Don't use CPM when:**
- ❌ Single project solution (little benefit, extra complexity)
- ❌ Simple console app or tool
- ❌ Proof of concept or throwaway code

**Why:** CPM adds a file and indirection for minimal gain.

### Legacy Projects

**Problem:** Migrating to CPM reveals all existing version conflicts at once.

**If you have:**
```
Project A: Newtonsoft.Json 12.0.3
Project B: Newtonsoft.Json 13.0.1
Project C: Newtonsoft.Json 11.0.2
```

**CPM forces you to pick ONE version immediately:**
```xml
<PackageVersion Include="Newtonsoft.Json" Version="???" />
```

**Solution:** Migrate incrementally:
1. Align versions manually first
2. Then enable CPM
3. Or keep using per-project versions

### Version Ranges

**CPM doesn't support version ranges:**
```xml
<!-- ❌ Not supported in CPM -->
<PackageVersion Include="System.Text.Json" Version="[8.0.0, 9.0.0)" />
```

**If you need ranges, use traditional package references:**
```xml
<PackageReference Include="System.Text.Json" Version="[8.0.0, 9.0.0)" />
```

### Multi-Repo Setup

**Don't use CPM across repositories:**
- ❌ Each repo should manage its own versions
- ❌ Sharing Directory.Packages.props across repos creates coupling

**Why:** Repositories are independent deployment units and should have independent versioning.

## CPM vs Traditional

| Feature | Traditional | CPM |
|---------|------------|-----|
| Version location | Each .csproj | Directory.Packages.props |
| Version conflicts | Possible | Impossible |
| Update effort | Update each project | Update once |
| Visibility | Scattered | Centralized |
| SDK requirement | Any | .NET 6.0.300+ |
| Version ranges | ✅ Supported | ❌ Not supported |
| Setup complexity | Low | Medium |
| Best for | Single project | Multi-project |
