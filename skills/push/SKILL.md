---
name: push
description: "Runs project quality gates before pushing. Auto-detects lint, format, typecheck, test, and build commands from project config. Fixes auto-fixable issues and amends the last commit. Use when pushing, git push, pushing changes, push to remote, or before creating a PR."
allowed-tools: Bash Read
metadata:
  author: Saturate
  version: "1.0"
---

# Push

Run all detected project quality gates before pushing. If auto-fixable issues are found (formatting, linting), fix them and amend the last commit. If non-fixable issues are found (test failures, type errors), stop and report.

## Progress checklist

```
Push skill progress:
- [ ] Step 0: Safety checks
- [ ] Step 1: Detect project gates
- [ ] Step 2: Run gates
- [ ] Step 3: Amend if needed
- [ ] Step 4: Push
```

## Step 0: Safety checks

Before anything else:

```bash
# What branch are we on?
git branch --show-current

# Reject force-push to main/master
# If the user's command contains --force or -f targeting main/master, STOP and warn.

# Check if remote is ahead
git fetch origin
git status -sb
```

- If on `main` or `master` and the command is a force-push: **stop, warn, do not proceed**.
- If remote is ahead: **stop, suggest pull/rebase first**.
- If nothing to push (up to date): **stop, say so**.

## Step 1: Detect project gates

Scan project config files to find available quality commands. Check these in order:

### Node.js (package.json)

Look for these script names in `scripts`:
- **format**: `format`, `prettier`, `fmt`
- **lint**: `lint`, `lint:fix`, `eslint`
- **typecheck**: `typecheck`, `type-check`, `tsc`, `types`
- **test**: `test`, `test:unit`, `test:ci`, `vitest`, `jest`
- **build**: `build`, `build:ci`

Detect the package manager from lock files:
- `pnpm-lock.yaml` -> pnpm
- `bun.lockb` or `bun.lock` -> bun
- `yarn.lock` -> yarn
- `package-lock.json` -> npm

### Python (pyproject.toml, setup.cfg, Makefile)

- **format**: `ruff format`, `black`
- **lint**: `ruff check --fix`, `flake8`, `pylint`
- **typecheck**: `mypy`, `pyright`
- **test**: `pytest`

Check if tools are in `[project.optional-dependencies]` or `[tool.*]` sections.

### Rust (Cargo.toml)

- **format**: `cargo fmt`
- **lint**: `cargo clippy --fix --allow-dirty`
- **test**: `cargo test`
- **build**: `cargo build`

### .NET (*.csproj, Directory.Build.props)

- **format**: `dotnet format`
- **lint**: `dotnet format analyzers`
- **test**: `dotnet test`
- **build**: `dotnet build`

### Go (go.mod)

- **format**: `gofmt -w .`
- **lint**: `golangci-lint run --fix` (if installed)
- **test**: `go test ./...`
- **build**: `go build ./...`

### Makefile / Justfile

If a `Makefile` or `justfile` exists, scan for targets named `lint`, `fmt`, `format`, `test`, `check`, `build`, `typecheck`. These take priority over language-specific detection when present.

### Pipeline files

Scan for CI config to cross-reference what gates CI will run:
- `.github/workflows/*.yml`
- `azure-pipelines.yml` or `.azure-pipelines/*.yml`
- `.gitlab-ci.yml`

Report what CI checks exist so the user knows what will run remotely. If a gate exists in CI but not locally, note it.

## Step 2: Run gates

Run detected gates in this order. Stop on the first non-fixable failure.

**Phase 1: Auto-fixable (format, lint)**

These can modify files. Run them and check if they changed anything.

```bash
# Example for Node.js with pnpm
pnpm run format 2>&1 || true
pnpm run lint:fix 2>&1 || pnpm run lint 2>&1 || true

# Check if files changed
git diff --stat
```

Track whether any files were modified. If yes, flag for amend in Step 3.

**Phase 2: Verification (typecheck, test, build)**

These are pass/fail. Run them in order; stop on first failure.

```bash
# Typecheck
pnpm run typecheck

# Tests
pnpm run test

# Build
pnpm run build
```

If any fail:
1. Report the failure clearly (include the error output)
2. Do NOT push
3. Do NOT amend
4. Ask the user how to proceed

## Step 3: Amend if auto-fix changed files

If Phase 1 modified files and Phase 2 passed:

```bash
git add -A
git commit --amend --no-edit
```

This keeps the auto-fix changes in the existing commit instead of creating a "fix lint" commit.

If Phase 1 modified files but Phase 2 failed: do NOT amend. The user needs to fix the Phase 2 failure first, and may want to see what the formatter changed separately.

## Step 4: Push

All gates passed. Push with the skill acknowledgment:

```bash
SKILL_ACK=push git push origin HEAD
```

If the original command had specific flags (e.g., `-u`, `--set-upstream`, a specific remote), preserve them.

## Skipping gates

The default is to run all detected gates. To skip specific gates, prefix the push command:

```bash
SKILL_ACK=push:skip-tests git push origin HEAD
SKILL_ACK=push:skip-build git push origin HEAD
SKILL_ACK=push:skip-tests,skip-build git push origin HEAD
```

Only skip when the user gives a reason (e.g., "just pushing docs, skip tests").

## Gate detection summary

After detection, print a summary before running:

```
Detected gates:
  format:    pnpm run format
  lint:      pnpm run lint:fix
  typecheck: pnpm run typecheck
  test:      pnpm run test
  build:     pnpm run build
  CI:        GitHub Actions (ci.yml: lint, test, build)

Running all gates...
```

If no gates are detected, warn the user and push anyway.
