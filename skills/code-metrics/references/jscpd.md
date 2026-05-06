# jscpd — Duplicate Code Detection

## Contents

- Install
- Basic usage
- Useful flags
- Config file (`.jscpd.json`)
- Reading the output
- Tuning `min-tokens`
- Patterns (monorepo scan, CI gate, feeding into LLM prompts)
- Known limits (rule of three, wrong-abstraction trap, what jscpd misses)
- Recommended first run

`jscpd` is a token-based copy-paste detector. It finds duplicated code blocks across files by tokenizing source and matching identical token sequences.

## Install

```bash
npm i -g jscpd
# or use ad-hoc:
npx jscpd .
```

Supports 150+ languages via Prism tokenizers.

## Basic usage

```bash
# Scan current directory
jscpd .

# Scan specific directories
jscpd ./apps ./packages
```

Default output goes to `.jscpd-report/` (HTML + JSON) plus a console summary.

## Useful flags

```bash
# Ignore patterns — note the ** is required for nested matches
jscpd --ignore "**/node_modules/**,**/dist/**,**/*.gen.*" .

# Minimum token count (default 50 — raise to reduce noise)
jscpd --min-tokens 70 .

# Minimum line count (default 5)
jscpd --min-lines 10 .

# Filter by language/format
jscpd --format "typescript,javascript,markup" .

# Reporters — consoleFull shows full diff blocks
jscpd --reporters consoleFull .
jscpd --reporters "console,json,html" .

# Output directory for reports
jscpd --output ./reports .

# Emit JSON only (good for feeding into LLM context or scripts)
jscpd --silent --reporters json --output /tmp/jscpd .
cat /tmp/jscpd/jscpd-report.json
```

## Config file

Create `.jscpd.json` at project root for reusable config:

```json
{
  "threshold": 5,
  "minTokens": 50,
  "minLines": 5,
  "ignore": [
    "**/node_modules/**",
    "**/dist/**",
    "**/.nuxt/**",
    "**/.output/**",
    "**/*.gen.*",
    "**/generated/**",
    "**/pnpm-lock.yaml"
  ],
  "format": ["typescript", "javascript", "markup", "vue"],
  "reporters": ["console", "html"]
}
```

`threshold` is the allowed duplication % — the tool exits non-zero if exceeded, useful for CI gating.

## Reading the output

Console summary:

```
Clone found (typescript):
 - apps/department-portal/app/utils/locale.ts [1:1 - 55:2] (54 lines, 298 tokens)
   apps/member-portal/app/utils/locale.ts [1:1 - 55:2]
```

- First path = source of the clone (lexicographically first)
- Second path = duplicate location(s)
- `[start:col - end:col]` = byte range in the file
- Line and token counts of the duplicated block

Totals at the end:

```
Found 32 clones.
Duplications detection: Found 32 exact clones with 1024(3.2%) duplicated lines in 284 (26 formats) files.
```

## Tuning `min-tokens`

This is the biggest noise-vs-signal lever.

| `--min-tokens` | What you get |
|----------------|--------------|
| 30 | Very noisy. Matches short import blocks, similar interface stubs. |
| 50 (default) | Reasonable for most projects. |
| 70–100 | Only substantial duplication. Good for initial audits. |
| 150+ | Only architectural-level copy-paste (entire config files, components). |

For a **first-pass audit**: start at 100 to see the big wins, drop to 50 to catch the smaller stuff.

## Patterns

### Monorepo — find cross-app duplication

```bash
jscpd \
  --ignore "**/node_modules/**,**/*.gen.*,**/dist/**" \
  --min-tokens 50 \
  --format "typescript,javascript,markup" \
  --reporters consoleFull \
  ./apps ./packages
```

Scope explicitly to source dirs — don't let jscpd walk the whole tree.

### CI gate

```bash
# Fail if duplication exceeds 5%
jscpd --threshold 5 --silent .
# Exit code is 1 if over threshold
```

### Feed into LLM prompts

```bash
jscpd --silent --reporters json --output /tmp/jscpd ./src
jq '.duplicates[] | {files: [.firstFile.name, .secondFile.name], lines: .lines}' /tmp/jscpd/jscpd-report.json
```

## Known limits — read carefully

**Duplication is not always a problem.**

Two blocks being identical today doesn't mean they should share code. Common traps:

- **Premature abstraction** — two similar-looking functions in different domains often need to diverge. Merging them creates a rigid shared utility that bends every future change.
- **"Rule of three"** — a single pair of duplicates is often fine. Three or more occurrences is a stronger signal.
- **Config drift** — two config files byte-identical today might *need* to differ tomorrow when one app gets a feature the other doesn't.

**Before deduplicating, check:**

1. Do the two blocks represent the same *concept*, or just look the same?
2. Is there a history of one changing without the other? (`git log` on both files)
3. If they're colors, URLs, or labels — are they *actually* supposed to be identical? (A "brand color" hex might look like duplication but is semantic.)

**What jscpd misses:**

- **Near-duplicates** where variable names or a few tokens differ — tokenization is exact
- **Structurally similar code** (same shape, different specifics) — use AST-based tools like `pmd-cpd` or `simian` for this
- **Logical duplication** — two functions doing the same thing with totally different code
- **Impact priority** — a 300-line clone is weighted the same as a 10-line clone in the totals; read the sizes manually

**Generator noise:**

`.gen.ts`, `*_pb2.py`, `*.pb.go`, etc. produce massive false positives. Always exclude them.

## Recommended first run

```bash
jscpd \
  --ignore "**/node_modules/**,**/*.gen.*,**/generated/**,**/dist/**,**/.next/**,**/.nuxt/**,**/.output/**,**/build/**,**/*.lock,**/*.lockb,**/pnpm-lock.yaml,**/yarn.lock,**/package-lock.json" \
  --min-tokens 70 \
  --reporters consoleFull \
  .
```

Start here, then tune `--min-tokens` down if the output is too sparse.
