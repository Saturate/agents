# Interpreting Results

## Contents

- The single most important rule
- Fake complexity (the `??` trap, switches, guards, what real complexity looks like)
- Duplication traps (wrong-abstraction cost, rule of three, config vs visual duplication, when to trust jscpd)
- Combining signals (top priority, high priority, medium, low, noise)
- False-positive checklist
- Writing the report
- One-pager mental model

Raw metrics are easy to run and hard to read well. This guide covers common pitfalls, how to combine signals, and how to turn numbers into an honest triage report.

## The single most important rule

**Every metric is a flag, not a verdict.** Read the code before recommending action. Especially with Vue/TS, Python decorators, and Go error handling — all three tools produce false positives often enough that blindly trusting output will send you on wild goose chases.

## Fake complexity (and how to spot it)

Cyclomatic complexity counts branches. But many modern language idioms create branches that aren't really branches in the "control flow is hard to follow" sense.

### The `??` / `||` inflation trap

```typescript
function formatAddress(a: Address) {
  return [
    a.street ?? '',
    a.number ?? '',
    a.zip ?? '',
    a.city ?? '',
    // ... 36 more lines like this
  ].filter(Boolean).join(', ')
}
```

lizard will report this as CCN 40. It is not complex — it is a straight mapper with defaults. The "fix" is not splitting the function, it's:

1. Making the `Address` type's fields required (type-level fix)
2. Extracting a `withDefaults(obj, defaults)` utility
3. Or accepting that this is what optional-heavy data looks like

If you see a high CCN on a function and the code is a long list of `x ?? y` or `x || y`, **don't refactor it for CCN's sake**. The signal is noisy.

### Switch statement CCN

A 30-case switch has CCN 30. Usually fine if each case is a one-liner. Only split if the cases themselves are complex.

### Guard-clause CCN

Early returns inflate CCN but *reduce* cognitive load. A function with 8 guard clauses followed by the happy path is often clearer than 8 nested ifs with CCN 8 from the nesting. Both score the same. Prefer guards.

### What real complexity looks like

- Deep nesting (ND > 3)
- Multiple exit paths intertwined with state mutation
- CCN high **and** nesting depth high **and** NLOC high
- Long functions (>80 NLOC) where the CCN isn't from flat switch/coalesce

Prioritize the intersection: `CCN > 15 AND ND > 3 AND NLOC > 50`. That's almost always a real mess.

## Duplication traps

Not all duplicates should be merged.

### The "wrong abstraction" cost

Two functions that look identical but belong to different domains will diverge. If you merge them into a shared utility, every future change has to handle both domains — often the utility grows flags and branches until it's worse than the duplication was.

> "Duplication is far cheaper than the wrong abstraction." — Sandi Metz

### Rule of three

A single duplicated pair is rarely worth extracting. Three or more occurrences is a stronger case. Four is almost always correct to extract.

### Config duplication is usually real debt

Duplicated `eslint.config.mjs`, `vitest.config.ts`, `tsconfig.json` between monorepo apps is almost always worth extracting — these evolve together by necessity, and drift is a bug.

### Visual duplication is usually fine

Button components, card layouts, error states — these may look similar but have distinct props, events, accessibility needs. Don't merge two 30-line components just because they both have a spinner and an error message.

### When to trust jscpd's flag

| Signal | Action |
|--------|--------|
| Byte-identical files between apps in a monorepo | Extract to shared package — almost always correct |
| Hundreds of lines duplicated in a single large block | Extract — you're in the rule-of-three zone |
| 6+ internal repetitions in one file (e.g. SVG filters, form fields) | Loop it — no downside |
| Two similar-looking but conceptually distinct components | Leave it. Duplication < wrong abstraction. |
| Auto-generated code flagged as duplicate | Exclude from future runs |

## Combining signals — where the real value is

The Venn diagram of the three tools is where cleanup ROI is highest.

### Top priority: flagged by all three

- Duplicated AND high-CCN AND large = definitely refactor
- Example: a 200-line function copy-pasted across 3 files with CCN 25 each → extract the shared logic, simplify the control flow during extraction

### High priority: duplicate + large

- Duplicated config files, shared utility files → extract
- No complexity signal needed; the duplication alone is the issue

### Medium priority: high complexity, not duplicated

- Gnarly but isolated functions → refactor when you're already in the file
- Don't make a dedicated PR unless the code is actively painful

### Low priority / skip: high LOC only

- A 600-line file isn't inherently bad
- Check for internal structure (many small functions?) before flagging

### Noise: single-tool signals with no corroboration

- High CCN on a null-coalesce heavy mapper
- Duplication in test fixtures
- High LOC in auto-generated files

## False-positive checklist

Before putting a finding in a report, confirm:

- [ ] Is this file auto-generated?
- [ ] Is the high CCN from `??`/`||` chains?
- [ ] Are the "duplicate" blocks semantically equivalent, not just syntactically?
- [ ] If I merged these duplicates, would future features naturally work in both callsites?
- [ ] Is this code actually called? (Dead code inflates all metrics.)
- [ ] Does this match a domain concept that deserves its complexity?

If you can't answer yes-or-no on these, **read the file**.

## Writing the report

Structure findings by priority, not by tool. Readers care about "what should I look at first", not "which tool found this."

Template:

```markdown
## Top priority — cross-tool hits

1. `file.ts:funcName` — duplicated in 3 places, CCN 22, 150 lines. Extract + simplify.

## Duplication debt

2. `app.config.ts` — 302 lines identical across 2 apps. Extract to shared preset.
3. `vitest.config.ts` — 43 lines identical across apps. Root-level config.

## Complexity hotspots (read before acting)

4. `ClubInfo.vue:formatAddress` — CCN 40, but from `??` chains. Real fix: make Address fields required. Not a control-flow problem.
5. `oauth-callback.ts` — CCN 21, 68 NLOC. Real multi-step handler; split into named steps.

## Size flags (triage, not action)

- Largest hand-written file: `clubStore.ts` at 412 lines — consider splitting by feature area

## What these tools didn't check

- Test coverage, dead code, runtime behavior, template complexity (Vue), coupling between modules.
```

Keep the "didn't check" section — it keeps the report honest and prevents downstream readers from over-trusting the metrics.

## One-pager mental model

| Metric | What it flags well | What it flags poorly |
|--------|-------------------|---------------------|
| LOC | Bloat, generator noise, file bigness | Value, quality |
| CCN | Tangled control flow, deep conditionals | Optional-heavy mappers, switches, guards |
| Duplication | Monorepo config drift, rule-of-three patterns | Visual similarity, domain-distinct code |

The tools are cheap. Run them often, trust them little, read the code always.
