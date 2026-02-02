# Example Output

Reference for: Azure DevOps Project Initialization

**Note:** Examples below show `~/code/` as the base directory. In practice, the base directory is auto-detected from your current location (~/code/, ~/git/, ~/projects/, etc.) or you will be prompted to choose one.

## Example 1: Non-namespaced repos (uses project folder)

```
✓ Git is installed (version 2.39.0)
✓ Azure DevOps access configured

Finding project "Platform Services"...
✓ Found: Platform Services (ID: 0d1e562b-95af-4c55-a8ce-8f26508d50ed)

Listing repositories...
Found 4 repositories:
  - Api (125 MB)
  - Frontend (89 MB)
  - Infrastructure (12 MB)
  - Docs (5 MB)

Repository naming analysis:
⚠ Repositories are not namespaced (e.g., Api, Frontend)
→ Organizing in project folder: ~/code/platform-services/

Cloning repositories...
[1/4] Cloning Api...
✓ Cloned Api → ~/code/platform-services/api

[2/4] Cloning Frontend...
✓ Cloned Frontend → ~/code/platform-services/frontend

[3/4] Cloning Infrastructure...
⊘ Skipped Infrastructure (already exists)

[4/4] Cloning Docs...
✓ Cloned Docs → ~/code/platform-services/docs

Summary:
✓ Successfully cloned: 3 repositories
⊘ Skipped: 1 repository
✗ Failed: 0 repositories

Location: ~/code/platform-services

Next steps:
  cd ~/code/platform-services/api
```

## Example 2: Properly namespaced repos (directly in base directory)

```
✓ Git is installed (version 2.39.0)
✓ Azure DevOps access configured

Finding project "Acme Platform"...
✓ Found: Acme Platform (ID: a1b2c3d4-...)

Listing repositories...
Found 3 repositories:
  - Acme.Platform.Api (145 MB)
  - Acme.Platform.Frontend (210 MB)
  - Acme.Platform.Hosting (18 MB)

Repository naming analysis:
✓ Repositories are properly namespaced (e.g., Acme.Platform.Api)
→ Placing directly in ~/code/

Cloning repositories...
[1/3] Cloning Acme.Platform.Api...
✓ Cloned Acme.Platform.Api → ~/code/acme.platform.api

[2/3] Cloning Acme.Platform.Frontend...
✓ Cloned Acme.Platform.Frontend → ~/code/acme.platform.frontend

[3/3] Cloning Acme.Platform.Hosting...
✓ Cloned Acme.Platform.Hosting → ~/code/acme.platform.hosting

Summary:
✓ Successfully cloned: 3 repositories
⊘ Skipped: 0 repositories
✗ Failed: 0 repositories

Location: ~/code

Next steps:
  cd ~/code/acme.platform.api
```
