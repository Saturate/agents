# Migration Strategies

Complete guide for migrating between package management approaches.

## Table of Contents

- [Traditional → CPM](#traditional--cpm)
- [CPM → Traditional](#cpm--traditional)
- [Migration Checklist](#migration-checklist)
- [Common Migration Issues](#common-migration-issues)

## Traditional → CPM

Migrate from per-project package versions to Central Package Management.

### Prerequisites

**Check requirements:**
```bash
# Verify .NET SDK version (need 6.0.300+)
dotnet --version

# Should output 6.0.300 or higher
```

### Migration Steps

#### Step 1: Create Directory.Packages.props

```bash
cat > Directory.Packages.props << 'EOF'
<Project>
  <PropertyGroup>
    <ManagePackageVersionsCentrally>true</ManagePackageVersionsCentrally>
  </PropertyGroup>
  <ItemGroup>
    <!-- Versions will be added here -->
  </ItemGroup>
</Project>
EOF
```

#### Step 2: Extract Package Versions

**Find all package references with versions:**
```bash
grep -r "PackageReference.*Version=" --include="*.csproj" . | \
  sed -E 's/.*Include="([^"]+)".*Version="([^"]+)".*/\1 \2/' | \
  sort -u
```

**Output example:**
```
Newtonsoft.Json 13.0.3
Serilog 3.1.1
Microsoft.Extensions.Logging 8.0.0
```

#### Step 3: Add Versions to Directory.Packages.props

**Manually add each package:**
```xml
<Project>
  <PropertyGroup>
    <ManagePackageVersionsCentrally>true</ManagePackageVersionsCentrally>
  </PropertyGroup>

  <ItemGroup>
    <PackageVersion Include="Newtonsoft.Json" Version="13.0.3" />
    <PackageVersion Include="Serilog" Version="3.1.1" />
    <PackageVersion Include="Microsoft.Extensions.Logging" Version="8.0.0" />
  </ItemGroup>
</Project>
```

**Or organize with shared versions:**
```xml
<Project>
  <PropertyGroup>
    <ManagePackageVersionsCentrally>true</ManagePackageVersionsCentrally>
  </PropertyGroup>

  <PropertyGroup Label="SharedVersions">
    <MicrosoftExtensionsVersion>8.0.0</MicrosoftExtensionsVersion>
  </PropertyGroup>

  <ItemGroup>
    <PackageVersion Include="Newtonsoft.Json" Version="13.0.3" />
    <PackageVersion Include="Serilog" Version="3.1.1" />
    <PackageVersion Include="Microsoft.Extensions.Logging" Version="$(MicrosoftExtensionsVersion)" />
  </ItemGroup>
</Project>
```

#### Step 4: Remove Versions from .csproj Files

**Automated approach:**
```bash
# Remove all Version attributes from PackageReference elements
find . -name "*.csproj" -exec sed -i '' 's/ Version="[^"]*"//g' {} \;
```

**Manual approach (safer):**
Edit each .csproj file:

**Before:**
```xml
<ItemGroup>
  <PackageReference Include="Newtonsoft.Json" Version="13.0.3" />
  <PackageReference Include="Serilog" Version="3.1.1" />
</ItemGroup>
```

**After:**
```xml
<ItemGroup>
  <PackageReference Include="Newtonsoft.Json" />
  <PackageReference Include="Serilog" />
</ItemGroup>
```

#### Step 5: Verify Migration

```bash
# Restore packages
dotnet restore

# Build solution
dotnet build

# Verify no inline versions remain
grep -r "PackageReference.*Version=" --include="*.csproj" .
# Should return nothing

# List packages to verify versions
dotnet list package
```

#### Step 6: Test Thoroughly

```bash
# Run all tests
dotnet test

# Check for any restore/build issues
dotnet clean
dotnet restore
dotnet build
```

### Handling Conflicts

**Problem:** Projects have different versions of same package

**Example:**
```
Project A: Newtonsoft.Json 12.0.3
Project B: Newtonsoft.Json 13.0.1
Project C: Newtonsoft.Json 11.0.2
```

**Solution 1: Choose latest compatible version**
```xml
<PackageVersion Include="Newtonsoft.Json" Version="13.0.1" />
```

Test each project after migration.

**Solution 2: Use version overrides temporarily**
```xml
<!-- Project that needs older version -->
<ItemGroup>
  <PackageReference Include="Newtonsoft.Json" VersionOverride="12.0.3" />
</ItemGroup>
```

**Solution 3: Update code to work with single version**

Preferred long-term approach. Update incompatible projects to use the same version.

## CPM → Traditional

Revert from Central Package Management to per-project versions.

### When to Revert

- Need version ranges (CPM doesn't support)
- .NET SDK < 6.0.300
- Team finds CPM too complex
- Single-project solution (little benefit)

### Migration Steps

#### Step 1: Extract Versions from Directory.Packages.props

```bash
# Show all package versions
grep "PackageVersion" Directory.Packages.props
```

**Example output:**
```xml
<PackageVersion Include="Newtonsoft.Json" Version="13.0.3" />
<PackageVersion Include="Serilog" Version="3.1.1" />
```

#### Step 2: Add Versions to Each .csproj

**For each project, edit .csproj:**

**Before (CPM):**
```xml
<ItemGroup>
  <PackageReference Include="Newtonsoft.Json" />
  <PackageReference Include="Serilog" />
</ItemGroup>
```

**After (Traditional):**
```xml
<ItemGroup>
  <PackageReference Include="Newtonsoft.Json" Version="13.0.3" />
  <PackageReference Include="Serilog" Version="3.1.1" />
</ItemGroup>
```

**Script to help:**
```bash
# List what needs to be updated
for csproj in $(find . -name "*.csproj"); do
  echo "=== $csproj ==="
  grep "PackageReference" "$csproj" | grep -v "Version="
done
```

#### Step 3: Remove Directory.Packages.props

```bash
# Backup first
cp Directory.Packages.props Directory.Packages.props.bak

# Remove
rm Directory.Packages.props
```

#### Step 4: Verify Migration

```bash
# Restore
dotnet restore

# Build
dotnet build

# Run tests
dotnet test

# Check packages are correct
dotnet list package
```

#### Step 5: Cleanup

```bash
# If everything works, remove backup
rm Directory.Packages.props.bak

# Commit changes
git add .
git commit -m "chore: migrate from CPM to traditional package management"
```

## Migration Checklist

### Pre-Migration

- [ ] Backup current state (git commit)
- [ ] Check .NET SDK version (`dotnet --version`)
- [ ] Document current package versions
- [ ] Verify all tests pass
- [ ] Note any custom package configurations

### During Migration

- [ ] Create/remove Directory.Packages.props
- [ ] Update all .csproj files
- [ ] Verify no inline versions remain (CPM)
- [ ] Verify all versions are inline (Traditional)
- [ ] Run `dotnet restore`
- [ ] Run `dotnet build`

### Post-Migration

- [ ] Run all tests (`dotnet test`)
- [ ] Check for restore warnings
- [ ] Verify package versions are correct (`dotnet list package`)
- [ ] Test in clean environment (delete obj/bin, restore, build)
- [ ] Update CI/CD pipeline if needed
- [ ] Document migration in commit message
- [ ] Update team documentation

## Common Migration Issues

### Issue: Build Fails After Migration

**Symptom:** Build succeeds before migration, fails after

**Causes:**
- Version mismatch between Directory.Packages.props and project needs
- Missing package versions
- Incompatible package versions

**Solution:**
```bash
# Clean and rebuild
dotnet clean
dotnet restore --verbosity detailed
dotnet build --verbosity normal
```

Check error messages for missing or incompatible versions.

### Issue: Packages Not Found

**Symptom:** "Package 'X' not found" after migration

**Cause:** Package version missing from Directory.Packages.props

**Solution:**
```xml
<!-- Add missing package to Directory.Packages.props -->
<PackageVersion Include="MissingPackage" Version="1.0.0" />
```

### Issue: Version Conflicts After CPM Migration

**Symptom:** Multiple projects needed different versions, CPM forces one

**Solution 1: Use version overrides (temporary)**
```xml
<!-- In specific project -->
<PackageReference Include="PackageName" VersionOverride="1.0.0" />
```

**Solution 2: Update code (preferred)**

Update projects to work with single version.

**Solution 3: Revert to traditional**

If conflicts are too complex to resolve.

### Issue: CI Pipeline Breaks

**Symptom:** CI worked before migration, fails after

**Causes:**
- CI doesn't have new Directory.Packages.props
- Build script expects old structure
- Wrong .NET SDK version

**Solutions:**
```bash
# Ensure Directory.Packages.props is committed
git add Directory.Packages.props
git commit -m "Add CPM configuration"

# Update CI to use .NET 6.0.300+
# Update build scripts if they reference package versions
```

### Issue: Git Merge Conflicts in Directory.Packages.props

**Symptom:** Merge conflicts after migration

**Solution:**
```bash
# Accept both changes, then consolidate
git checkout --ours Directory.Packages.props
git checkout --theirs Directory.Packages.props

# Manually merge both sets of packages
# Then restore and verify
dotnet restore
dotnet build
```

## Gradual Migration Strategy

For large solutions, migrate incrementally:

### Phase 1: Add CPM Without Removing Inline Versions

```xml
<!-- Directory.Packages.props -->
<Project>
  <PropertyGroup>
    <ManagePackageVersionsCentrally>true</ManagePackageVersionsCentrally>
  </PropertyGroup>
  <!-- Add centralized versions -->
</Project>
```

Projects still work with inline versions due to backward compatibility.

### Phase 2: Migrate Projects One at a Time

Remove inline versions from one project, test, commit:

```bash
# Migrate project 1
vim src/Project1/Project1.csproj  # Remove versions
dotnet restore
dotnet test
git commit -m "Migrate Project1 to CPM"

# Migrate project 2
vim src/Project2/Project2.csproj  # Remove versions
dotnet restore
dotnet test
git commit -m "Migrate Project2 to CPM"
```

### Phase 3: Complete Migration

After all projects migrated, verify:

```bash
# Should return nothing
grep -r "PackageReference.*Version=" --include="*.csproj" .
```

## Rollback Plan

If migration fails, rollback:

```bash
# Revert to last commit
git reset --hard HEAD~1

# Or revert specific commit
git revert <commit-hash>

# Or restore from backup
git restore Directory.Packages.props
git restore **/*.csproj
```

**Always test rollback procedure before starting migration!**
