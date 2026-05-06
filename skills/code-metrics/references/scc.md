# scc — Lines of Code & Rough Complexity

## Contents

- Install
- Basic usage
- Useful flags
- Reading the output
- Patterns (baseline snapshot, suspiciously large files, per-app monorepo breakdown, spotting generator noise)
- Integration with CI
- Known limits

`scc` (Sloc Cloc Code) is a fast Go-based LOC counter. Faster than `cloc` and `tokei`, with a rough complexity estimate included.

## Install

```bash
brew install scc                          # macOS
go install github.com/boyter/scc/v3@latest  # any platform with Go
```

## Basic usage

```bash
# Scan current directory
scc

# Scan specific path
scc src/

# Exclude noise directories
scc --exclude-dir node_modules,.nuxt,.output,dist,build,target,vendor

# Skip COCOMO cost estimation (noise for most reports)
scc --no-cocomo
```

## Useful flags

```bash
# Per-file breakdown (sorted by complexity)
scc --by-file -s complexity

# Per-file breakdown (sorted by lines)
scc --by-file -s lines

# Filter by language
scc --include-ext ts,tsx,vue

# Show largest files only
scc --by-file -s lines | head -30

# JSON output for scripting or LLM prompts
scc --format json > metrics.json

# CSV output
scc --format csv
```

## Reading the output

```
Language      Files   Lines   Blanks  Comments   Code  Complexity
TypeScript      124  20,223    1,883     7,131  11,209         764
Vue             111  10,315      932       233   9,150         414
```

| Column | Meaning |
|--------|---------|
| **Files** | File count |
| **Lines** | Total lines incl. blanks & comments |
| **Blanks** | Blank lines |
| **Comments** | Comment lines |
| **Code** | Actual code lines (Lines – Blanks – Comments) |
| **Complexity** | Rough branch count aggregated across files |

The **Complexity** column is a coarse signal — it counts branch keywords (`if`, `for`, `switch`, etc.) at the file level. Use it to compare files against each other, not as an absolute truth. For function-level complexity, use `lizard` instead.

## Patterns

### Baseline snapshot

```bash
scc --exclude-dir node_modules,.nuxt,.output,dist --no-cocomo > metrics-before.txt
# ...do cleanup work...
scc --exclude-dir node_modules,.nuxt,.output,dist --no-cocomo > metrics-after.txt
diff metrics-before.txt metrics-after.txt
```

### Find suspiciously large files

```bash
scc --by-file -s lines --exclude-dir node_modules,.nuxt,dist | head -40
```

Files over ~500 lines of code deserve a look. Files over 1000 lines are almost always doing too much.

### Monorepo per-app breakdown

```bash
for app in apps/*/; do
  echo "=== $app ==="
  scc --exclude-dir node_modules,.nuxt,.output,dist --no-cocomo "$app"
done
```

### Spot generator noise

If one file dwarfs the rest in complexity, check whether it's generated:

```bash
scc --by-file -s complexity | head -10
# If the top files are under .gen.ts / generated/ — exclude them and re-run
```

## Integration with CI

scc exits 0 regardless of metrics, so use it for reporting rather than gating. For gating, pair with a small script:

```bash
# Fail build if code LOC grows by more than 10% in a PR
BEFORE=$(git show main:metrics.json | jq '.[] | select(.Name=="Total") | .Code')
AFTER=$(scc --format json --exclude-dir node_modules . | jq '.[] | select(.Name=="Total") | .Code')
# compare and exit 1 if threshold exceeded
```

## Known limits

- Doesn't detect duplication — two identical files just look like two entries
- Complexity metric is aggregate and coarse — prefer lizard for per-function analysis
- Won't tell you if code is dead, untested, or poorly structured
- Counts lines, not value — 500 lines of clean domain logic and 500 lines of copy-paste look identical
