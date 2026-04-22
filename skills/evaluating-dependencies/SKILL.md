---
name: evaluating-dependencies
description: Evaluates packages before installation across npm, pnpm, yarn, bun, cargo, pip, uv, go, and nuget. Checks footprint, maintenance status, alternatives, license, and security. Use when adding dependencies, choosing between libraries, optimizing bundle size, or running npm install, pnpm add, yarn add, bun add, cargo add, pip install, uv add, go get, or dotnet add package.
user-invocable: true
allowed-tools: Bash WebFetch WebSearch Read Grep
metadata:
  author: Saturate
  version: "2.0"
---

# Evaluating Dependencies

Evaluate packages before installation — across ecosystems — to make informed decisions about footprint, maintenance, alternatives, license, and security.

## Universal decision framework

Run these checks regardless of ecosystem. Tools differ; the questions don't.

```
Evaluation Progress:
- [ ] 1. Need check            — do we actually need it? is it already in deps?
- [ ] 2. Alternatives          — identify 2-4 options if no specific package requested
- [ ] 3. Footprint             — size/impact (bundle, binary, import cost)
- [ ] 4. Maintenance           — last release, release cadence, deprecation status
- [ ] 5. Security              — known CVEs, audit results
- [ ] 6. License               — compatible with the project
- [ ] 7. Recommend             — pick one, justify briefly
- [ ] 8. Install               — pinned version, correct dep category
```

### 1. Need check

Before considering *which* package, ask *whether*:

- Is it already installed? (`package.json`, `Cargo.toml`, `pyproject.toml`, `go.mod`, `*.csproj`, `Directory.Packages.props`)
- Can the stdlib do it? (`Date` in JS, `datetime` in Python, `time` in Go, `chrono` in modern Rust projects)
- Is it a one-liner we can inline?

Adding a dep is a commitment — maintenance, security surface, lock file churn. Default to no.

### 2. Alternatives

If the user gave a specific package, proceed to Step 3 with it. Mention obvious alternatives if relevant.

If the user gave a generic need ("a date library", "a JSON parser"), identify 2-4 well-known options so the comparison is real.

### 3. Footprint

"Footprint" is ecosystem-specific:

| Ecosystem | What to measure | How |
|---|---|---|
| npm/pnpm/yarn/bun | Gzipped bundle size + dep count | bundlephobia API |
| cargo | Compiled binary impact, transitive deps | `cargo tree`, crates.io stats |
| pip/uv | Install size, transitive deps | `pip show`, pypi metadata |
| go | Transitive modules | `go mod graph`, pkg.go.dev |
| nuget | Download size, transitive deps | `dotnet list package --include-transitive` |

### 4. Maintenance

Red flags (any ecosystem):

- Last release > 2 years ago with no activity
- Deprecated (marked in registry, or replaced by a successor package)
- Single maintainer with no recent activity
- Issue tracker full of unanswered recent reports

Green flags:

- Released within the last ~6 months
- Multiple maintainers or org-backed
- Recent commits on the default branch

### 5. Security

Run an audit tool for the ecosystem (see "Ecosystem playbooks" below). CVE-laden dependencies are worth a hard no — look for an alternative.

### 6. License

Quick sanity check. MIT / Apache-2.0 / BSD are safe defaults. GPL/AGPL in a proprietary project is a conversation.

### 7. Recommend

Present in this format:

```
Option 1: <package> (recommended)
- Footprint: <size / deps>
- Latest: <version>
- Last updated: <timeframe>
- License: <spdx>
- Why: <smallest / most maintained / best types / etc.>

Option 2: <alternative>
- …
- Why not: <…>

Recommendation: install <package>@<version>
```

### 8. Install

Pin the version. Detect the package manager from lockfiles, never guess.

---

## Ecosystem playbooks

### npm / pnpm / yarn / bun

**Detect the package manager:**

```bash
if [ -f "bun.lockb" ]; then PM=bun
elif [ -f "pnpm-lock.yaml" ]; then PM=pnpm
elif [ -f "yarn.lock" ]; then PM=yarn
else PM=npm
fi
```

**Footprint — bundlephobia:**

```bash
curl -s "https://bundlephobia.com/api/size?package=<pkg>@latest" | jq '{size, gzip, dependencyCount}'
```

**Compare alternatives:**

```bash
for pkg in dayjs date-fns luxon; do
  curl -s "https://bundlephobia.com/api/size?package=$pkg@latest" | jq --arg p "$pkg" '{pkg: $p, gzip}'
done
```

**Version, dates, deprecation:**

```bash
npm view <pkg> version
npm view <pkg> time.modified
npm view <pkg> deprecated
npm view <pkg> dist-tags --json
```

**Downloads (popularity):**

```bash
curl -s "https://api.npmjs.org/downloads/point/last-week/<pkg>" | jq '.downloads'
```

**Security:**

```bash
npm audit                         # after install
# or pre-install:
npx npq install <pkg>             # sanity-checker
```

**Install (pinned):**

```bash
npm install <pkg>@<version>       # -D for dev
pnpm add <pkg>@<version>          # -D for dev
yarn add <pkg>@<version>          # -D for dev
bun add <pkg>@<version>           # -d for dev
```

**Common categories:**

| Need | Top options | Default pick |
|---|---|---|
| Date | dayjs, date-fns, luxon | dayjs (smallest) |
| HTTP | axios, ky, undici, got | ky (modern) or axios (ecosystem) |
| Validation | zod, valibot, yup | zod (TS-first) or valibot (smaller) |
| Testing | vitest, jest, uvu | vitest |
| State (React) | zustand, jotai, redux | zustand |
| Forms (React) | react-hook-form, formik | react-hook-form |
| UUID | uuid, nanoid | nanoid |
| Icons (React) | lucide-react, react-icons | lucide-react |

**Bundle thresholds (gzipped):**

| Size | Action |
|---|---|
| < 5 KB | Safe |
| 5–20 KB | Usually fine |
| 20–50 KB | Consider alternatives |
| 50–100 KB | Justify |
| > 100 KB | Look for something lighter |

### cargo (Rust)

**Check the registry:**

```bash
cargo search <crate>
cargo info <crate>                # cargo 1.76+
```

Otherwise: `https://crates.io/api/v1/crates/<crate>` returns JSON with downloads, versions, license, repository.

**Version + metadata via crates.io API:**

```bash
curl -s "https://crates.io/api/v1/crates/<crate>" | jq '{
  latest: .crate.max_stable_version,
  downloads: .crate.downloads,
  recent: .crate.recent_downloads,
  updated: .crate.updated_at,
  license: .versions[0].license
}'
```

**Dep tree + size context:**

```bash
cargo tree -p <crate>             # transitive deps
cargo bloat --release --crates    # after adding, if binary size matters
```

**Security:**

```bash
cargo install cargo-audit         # one-time
cargo audit
cargo install cargo-deny          # license + advisory policy
cargo deny check
```

**Outdated / deprecated:**

```bash
cargo install cargo-outdated
cargo outdated
```

**Install (pinned, via cargo add):**

```bash
cargo add <crate>@<version>
cargo add <crate>@<version> --features "a,b"
cargo add <crate>@<version> --dev
```

**Reference:** [lib.rs](https://lib.rs) is a better UX than crates.io for browsing; it surfaces maintenance signals and usage counts.

### pip / uv (Python)

**Prefer `uv` for speed and reproducibility.**

**Version + metadata via PyPI JSON API:**

```bash
curl -s "https://pypi.org/pypi/<pkg>/json" | jq '{
  latest: .info.version,
  license: .info.license,
  requires_python: .info.requires_python,
  last_release: .releases | to_entries | max_by(.value[0].upload_time) | .key,
  home: .info.home_page
}'
```

**Install size + transitive deps:**

```bash
pip show <pkg>                    # after install
pip show <pkg> | grep Requires
# or without installing:
pip install --dry-run <pkg> 2>&1 | head -30
```

**Security:**

```bash
pip install pip-audit             # one-time
pip-audit

pip install safety
safety check
```

**Install (pinned):**

```bash
# pip
pip install '<pkg>==<version>'

# uv (preferred)
uv add '<pkg>==<version>'
uv add --dev '<pkg>==<version>'
```

### go modules

**Metadata via pkg.go.dev (no JSON API — use the web page or proxy):**

```bash
# Resolve latest version
go list -m -versions <module>
# Module info
curl -s "https://proxy.golang.org/<module>/@latest" | jq
```

**Security:**

```bash
go install golang.org/x/vuln/cmd/govulncheck@latest
govulncheck ./...
```

**Transitive deps:**

```bash
go mod graph | grep <module>
go list -m -u all                 # outdated
```

**Install (pinned):**

```bash
go get <module>@<version>
go mod tidy
```

`go get` without `@version` pulls latest — always pin.

### nuget (.NET)

**Version + metadata via NuGet API:**

```bash
# Latest stable version
curl -s "https://api.nuget.org/v3-flatcontainer/<package>/index.json" | jq '.versions | last'

# Full metadata
curl -s "https://api.nuget.org/v3/registration5-semver1/<package>/index.json" | jq
```

**Dep tree + vuln scan (via dotnet CLI):**

```bash
dotnet list package --include-transitive
dotnet list package --vulnerable --include-transitive
dotnet list package --deprecated
dotnet list package --outdated
```

**Install (pinned):**

```bash
dotnet add package <Name> --version <ver>
```

For install *mechanics* (Central Package Management, version variables, workspaces), defer to the `nuget-package-management` skill.

---

## Anti-patterns (cross-ecosystem)

**Installing without pinning the version.**
Always install with an explicit version.

**Skipping the footprint check because "it's probably small".**
`moment` was 289 KB gzipped; the author thought it was small too. Check.

**Treating transitive deps as free.**
A 2 KB wrapper around a 200 KB tree is a 200 KB dep. `cargo tree`, `npm ls`, `pip show`, etc.

**Picking the popular one reflexively.**
Popular ≠ maintained. `moment` (maintenance mode) and `request` (deprecated) were once the default picks.

**Adding a lib for one function.**
A 6-line utility isn't worth a dep. Especially in TS/Rust where monomorphization + tree-shaking mean the cost shows up in build time anyway.

---

## Examples

### npm: generic request

**User:** "Add a date library"

1. Alternatives: dayjs, date-fns, luxon
2. Footprint (gzipped): dayjs 2.9 KB, date-fns 13 KB, luxon 25 KB
3. All actively maintained
4. Licenses all MIT
5. Recommend: dayjs (smallest, good DX). `npm install dayjs@1.11.10`

### cargo: specific crate

**User:** "Add tokio"

1. Need check: async runtime required for this server? yes.
2. Metadata: crates.io API → latest 1.37.0, license MIT, updated this month, 100M+ downloads
3. Feature footprint: `tokio = { version = "1.37", features = ["rt-multi-thread", "macros"] }` (avoid `full` — pulls everything).
4. Security: `cargo audit` clean.
5. Install: `cargo add tokio@1.37 --features rt-multi-thread,macros`

### pip: bundle replacement

**User:** "Our Python deploys are slow, image is 2GB"

1. Check `pip list` + `pip show <pkg>` for largest installs
2. Flag candidates: pandas (heavy), scipy (heavy)
3. Suggest: if only using `read_csv`, consider `polars` (smaller, faster) or stdlib `csv`
4. Measure after swap.

### nuget: package with CPM

**User:** "Add Serilog"

1. Delegate install mechanics to `nuget-package-management` (CPM, shared version vars)
2. Metadata: nuget.org → latest 4.0.0, license Apache-2.0, actively maintained
3. Vuln scan: `dotnet list package --vulnerable` clean
4. Install: use `dotnet add package Serilog` (CPM will pick the shared version)

---

## References

- **npm:** [bundlephobia](https://bundlephobia.com), [npmtrends](https://npmtrends.com), [Snyk advisor](https://snyk.io/advisor)
- **cargo:** [lib.rs](https://lib.rs), [crates.io](https://crates.io), [rustsec advisory DB](https://rustsec.org)
- **python:** [pypi](https://pypi.org), [Snyk advisor](https://snyk.io/advisor/python)
- **go:** [pkg.go.dev](https://pkg.go.dev), [osv.dev](https://osv.dev)
- **nuget:** [nuget.org](https://nuget.org), [GitHub Advisory DB](https://github.com/advisories)

Related skills:
- `nuget-package-management` — .NET install mechanics (CPM, version variables)
- `node-package-management` — npm/pnpm install mechanics, workspaces
