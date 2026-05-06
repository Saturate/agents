---
name: code-metrics
description: Runs code metric tools (scc for LOC, lizard for cyclomatic complexity, jscpd for duplicate detection) to produce triage signals for audits, cleanup, and refactoring prioritization. Use when asked for code health metrics, complexity hotspots, duplicate code, LOC breakdown, technical debt signals, what to clean up first, pre-audit analysis, or to feed metric context into other skills like codebase-audit or simplify. Not a fix-it tool — it surfaces flags, not mandates.
compatibility: Requires one or more of scc, lizard, jscpd. Install via brew/pipx/npm. Skill falls back gracefully if a tool is missing.
allowed-tools: Read Grep Glob Bash
metadata:
  author: Saturate
  version: "1.0"
---

# Code Metrics

Measure a codebase with three cheap, fast tools to produce signals other skills (or humans) can act on. This skill **measures**, it does not **fix** — the output is a set of flags and hotspots, not a list of mandates. Many flagged items are legitimately fine; the point is to know *where to look*.

## What each tool tells you

| Tool | Measures | Best for |
|------|----------|----------|
| **scc** | Lines of code, file counts, per-language breakdown, rough complexity estimate | Sizing the codebase, spotting bloated files, before/after cleanup comparisons |
| **lizard** | Cyclomatic complexity (CCN), NLOC, token count, nesting depth — per function | Finding gnarly functions worth a second look |
| **jscpd** | Duplicate code blocks across files | Monorepo duplication, copy-paste debt, missing shared packages |

Use all three when you want broad coverage. Use one when the question is specific (e.g. "is there copy-paste?" → jscpd only).

## When to invoke this skill

- User asks for a code audit, health check, or "what should I clean up"
- Planning a refactor — which files/functions are worth attacking
- Feeding context to `codebase-audit`, `simplify`, `pr-review`, or `hunting-bugs`
- Before/after comparison on a cleanup PR
- Surfacing hotspots to prioritize test coverage or documentation

## Process

```
Code Metrics Progress:
- [ ] Step 1: Check tool availability
- [ ] Step 2: Detect project shape and sensible exclusions
- [ ] Step 3: Run the tools the user asked for (or all three by default)
- [ ] Step 4: Verify flagged hotspots by reading source — skip noise
- [ ] Step 5: Produce a triage report
```

### 1. Check tool availability

```bash
command -v scc
command -v lizard
command -v jscpd || command -v npx
```

If a tool is missing, tell the user how to install it and offer to proceed with what's available. Don't block the whole skill on one missing tool.

Install commands:
- **scc**: `brew install scc` (macOS) or `go install github.com/boyter/scc/v3@latest`
- **lizard**: `pipx install lizard` (never `pip install` system-wide on macOS — PEP 668 blocks it)
- **jscpd**: `npm i -g jscpd` or use `npx jscpd` directly

### 2. Detect project shape and exclusions

Look at the project root to figure out what to exclude. Typical noise paths:

- `node_modules`, `.nuxt`, `.next`, `.output`, `dist`, `build`, `.turbo`, `.svelte-kit`
- `target` (Rust/Java), `bin`, `obj` (.NET)
- `__pycache__`, `.venv`, `venv`
- `vendor` (Go/PHP)
- Generated code: `*.gen.ts`, `**/generated/**`, `*.pb.go`, `*_pb2.py`, etc. — **these distort every metric**

Spot-check by globbing `**/*.gen.*` and `**/generated/**` before running, so you can exclude them.

### 3. Run the tools

For detailed flags, per-tool usage, and output interpretation see:

- [references/scc.md](references/scc.md) — LOC, breakdowns, per-file ranking
- [references/lizard.md](references/lizard.md) — complexity flags, thresholds, output format
- [references/jscpd.md](references/jscpd.md) — duplicate detection, ignore patterns, caveats

Quick combined run (adjust exclusions per project):

```bash
# LOC overview
scc --exclude-dir node_modules,.nuxt,.output,dist,build --no-cocomo

# Complexity warnings (CCN > 10)
lizard --exclude "node_modules/*" --exclude "**/*.gen.*" -T cyclomatic_complexity=10 -w

# Duplicates (scope to source dirs, don't scan whole tree)
jscpd --ignore "**/node_modules/**,**/*.gen.*,**/dist/**" --min-tokens 50 --reporters consoleFull ./src
```

For large repos, save output to `/tmp/code-metrics/` rather than piping through the terminal — reports get long.

### 4. Verify hotspots before recommending action

**Do not blindly trust the signal.** Always spot-read at least the worst offenders before putting them in the report.

Common false positives:

- **CCN inflated by `??` / `||` chains** — lizard counts every null-coalescing operator as a branch. A CCN-40 "address formatter" is often just 40 optional fields, not tangled logic. See [references/interpreting.md](references/interpreting.md#fake-complexity).
- **Duplicated-but-correct code** — two similar-looking blocks may belong to different domains and need to evolve independently. Merging them is the "wrong abstraction" trap.
- **Generated file noise** — always confirm these are excluded before reporting.
- **Identical-named files with identical line counts** — scc's per-file output can *hint* at duplication, but only jscpd confirms it.

When flagged code *is* real:
- High CCN + deep nesting + long function = almost always worth splitting
- Multi-app byte-identical files in a monorepo = almost always worth a shared package
- Internal repetition in a single file (e.g. 6 copies of an SVG filter) = almost always worth a loop

### 5. Produce a triage report

Organize findings so the reader (human or another skill/agent) can act:

1. **Project size** — total LOC, breakdown by language, notable files over ~500 lines
2. **Complexity hotspots** — top N functions by CCN, *after filtering generated code and trivial null-coalesce inflation*. Cite `file:line`.
3. **Duplication hotspots** — grouped by likely root cause (missing shared config, copy-pasted component, in-file repetition). Cite line ranges.
4. **Signal overlap** — functions/files flagged by more than one tool deserve priority
5. **Known limits** — one paragraph on what these tools *can't* see (templates, runtime behavior, coupling, dead code, test coverage)

Lead with the overlap section when present — a function that's both duplicated and high-complexity is the best cleanup ROI.

## Using this skill from other skills

Other skills can invoke this one (or copy the tool invocations) when they need metric context:

- **codebase-audit** — use the full triage report as one section of the audit
- **simplify** — use complexity + duplication hotspots as the target list
- **pr-review** — run before/after on the PR branch to show complexity/duplication drift
- **hunting-bugs** — high-CCN functions with minimal tests are bug farms worth searching

When invoked for context rather than standalone, skip the narrative report and emit structured data (the raw tool output paths, or a bullet list of `file:line  metric=value`).

## Guidelines

**Signals, not mandates:**
- Present findings as flags to investigate, not bugs to fix
- Never recommend a refactor without having read the file
- If a metric looks bad but the code is fine, say so in the report

**Honest about scope:**
- These are cheap static signals. They don't replace test coverage analysis, runtime profiling, or code review.
- CCN counts branches, not comprehension difficulty
- LOC counts lines, not value
- Duplicate detection counts tokens, not intent

**Reproducible:**
- Always save commands used + exclusions applied in the report, so the user can re-run and compare
- For monorepos, note whether you scanned apps, packages, or both

## References

- **[scc Reference](references/scc.md)** — LOC counting, per-language breakdown, per-file complexity ranking, CI integration
- **[lizard Reference](references/lizard.md)** — cyclomatic complexity, flags, thresholds, output formats, CI gate pattern
- **[jscpd Reference](references/jscpd.md)** — duplicate detection, ignore patterns, min-token tuning, monorepo patterns
- **[Interpreting Results](references/interpreting.md)** — signal vs noise, fake complexity, duplication traps, how to combine the three signals
