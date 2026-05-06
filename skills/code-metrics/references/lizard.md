# lizard — Cyclomatic Complexity

## Contents

- Install
- Basic usage
- Useful flags
- Output formats
- Reading the output
- Thresholds
- Patterns (hand-written focus, combined hotspot ranking, CI gate)
- Known limits (the `??` trap, switch statements, guard clauses, what's invisible)

`lizard` is a Python-based multi-language complexity analyzer. It reports cyclomatic complexity (CCN), non-comment LOC (NLOC), token count, parameter count, function length, and nesting depth per function.

## Install

```bash
pipx install lizard
```

Don't use `pip install lizard` on macOS — PEP 668 blocks system-wide pip installs. Use `pipx` or a venv.

## Basic usage

```bash
# Scan current directory
lizard

# Scan a specific path
lizard src/

# Only show functions over default thresholds (CCN > 15, length > 1000, args > 100)
lizard -w .
```

## Useful flags

```bash
# Filter to specific languages
lizard -l javascript -l typescript -l vue .
# Supported: c, cpp, java, csharp, js, ts, vue, python, go, rust, swift, kotlin, php, ruby, scala, lua, objectivec

# Exclude paths (glob, can repeat)
lizard --exclude "node_modules/*" --exclude "**/*.gen.*" --exclude "**/generated/**" .

# Lower the CCN warning threshold (default 15)
lizard -T cyclomatic_complexity=10 -w .

# Also gate on NLOC, length, parameters, nesting depth
lizard -T cyclomatic_complexity=10 -T nloc=50 -T parameter_count=5 -w .

# Sort by a metric (cyclomatic_complexity, nloc, length, token_count)
lizard -s cyclomatic_complexity .

# Show only the top N worst
lizard -s cyclomatic_complexity . | head -30
```

## Output formats

```bash
lizard --csv .            # CSV — great for scripting or prompt context
lizard --xml .            # XML — CI-friendly (Jenkins, etc.)
lizard --html . > r.html  # HTML report with tables
```

## Reading the output

```
./path/file.ts:12: warning: funcName has 68 NLOC, 21 CCN, 446 token, 0 PARAM, 83 length, 0 ND
```

| Metric | Meaning |
|--------|---------|
| **NLOC** | Non-comment lines (real code) |
| **CCN** | Cyclomatic complexity — branches + 1 |
| **token** | Total tokens in the function body |
| **PARAM** | Parameter count |
| **length** | Total lines incl. blanks & comments |
| **ND** | Maximum nesting depth |

Summary at the end:

```
Total nloc   Avg.NLOC  AvgCCN  Avg.token  function_cnt    file
      1200        6.5     2.5      42.1          180        150
```

## Thresholds

| CCN | Meaning |
|-----|---------|
| 1–5 | Trivial. Probably fine. |
| 6–10 | Moderate. Worth a glance but rarely a problem. |
| 11–15 | Getting heavy. Likely worth splitting if the function is also long. |
| 16–20 | Almost always improvable. |
| 21+ | Very likely a mess. Either deep branching, a giant switch, or a long chain of `??`. |

The default lizard threshold is CCN > 15. For Vue/TS codebases with lots of nullish coalescing, bump it to 20 or use lizard alongside NLOC/nesting thresholds, or the noise is overwhelming.

## Patterns

### Focus on hand-written code

```bash
lizard \
  --exclude "node_modules/*" \
  --exclude ".nuxt/*" \
  --exclude "dist/*" \
  --exclude "**/*.gen.*" \
  --exclude "**/generated/**" \
  -l javascript -l typescript -l vue \
  -T cyclomatic_complexity=10 \
  -w .
```

### Combined hotspot ranking

```bash
# Rank functions by CCN, show top 20
lizard --csv . \
  --exclude "node_modules/*" --exclude "**/*.gen.*" \
  | sort -t, -k2 -n -r | head -20
```

CSV columns: `nloc,ccn,tokens,params,length,location,filename,name,long_name,start,end`

### CI gate

```bash
# Fail build if any function exceeds CCN 20 or length 150 lines
lizard -C 20 -L 150 -w --exclude "**/*.gen.*" src/
# Exit code is 0 if clean, 1 if any function violates thresholds
```

`-C` sets CCN threshold, `-L` sets length threshold, `-a` sets parameter-count threshold.

## Known limits — read this carefully

**CCN is a syntactic count, not a comprehension score.**

lizard counts every `if`, `for`, `while`, `case`, `catch`, `&&`, `||`, `??`, and ternary as +1 to CCN. This means:

- A function with 40 fields mapped via `x ?? defaultX` gets CCN 40. It's not complex — it's tedious.
- A switch statement with 30 cases gets CCN 30. Probably fine if each case is a one-liner.
- A function with CCN 3 that mutates shared state across modules can be more dangerous than CCN 40 of linear null-handling.

**Always sanity-read the top hits.** If the high CCN comes from `??` chains on optional fields, the real fix is type design (make the fields required, or use a mapper utility), not "refactor to reduce CCN".

**Invisible to lizard:**

- Vue `<template>` blocks (only the `<script>` is scanned)
- JSX complexity inside `return` statements is counted but often misread
- Reactive dependency graphs (watchers, computeds)
- Coupling between functions
- Whether a function has tests or is even called

Use CCN as a flag that says "look at this". Not as a priority queue.
