---
name: doubt-driven-development
description: Subjects every non-trivial decision to a fresh-context adversarial review before it stands. Use when correctness matters more than speed, when working in unfamiliar code, when stakes are high (production, security-sensitive logic, irreversible operations), or any time a confident output would be cheaper to verify now than to debug later.
allowed-tools: Read Grep Glob Bash
metadata:
  author: Saturate
  version: "1.0"
---

# Doubt-Driven Development

A confident answer is not a correct one. Long sessions accumulate context that quietly turns assumptions into "facts" without anyone noticing. Doubt-driven development materializes a fresh-context reviewer, biased to **disprove** not approve, before any non-trivial output stands.

This is not `/review`. `/review` is a verdict on a finished artifact. This is an in-flight posture: non-trivial decisions get cross-examined while course-correction is still cheap.

## When to Use

A decision is **non-trivial** when at least one of these is true:

- It introduces or modifies branching logic
- It crosses a module or service boundary
- It asserts a property the type system cannot verify (thread safety, idempotence, ordering, invariants)
- Its correctness depends on context the future reader cannot see
- Its blast radius is irreversible (production deploy, data migration, public API change)

**When NOT to use:**

- Mechanical operations (renaming, formatting, file moves)
- Following a clear, unambiguous instruction
- Reading or summarizing existing code
- One-line changes with obvious correctness
- The user has explicitly asked for speed over verification

If you doubt every keystroke, you ship nothing.

## The Process

### Step 1: CLAIM - Surface what stands

Name the decision in two or three lines:

```
CLAIM: "The new caching layer is thread-safe under the
        read-heavy workload described in the spec."
WHY THIS MATTERS: a race here corrupts user data and is
                  hard to detect in QA.
```

If you can't write the claim that compactly, you have a vibe, not a decision. Surface it before scrutinizing it.

### Step 2: EXTRACT - Smallest reviewable unit

A fresh-context reviewer needs the **artifact** and the **contract**, not the journey.

- Code: the diff or the function, not the whole file
- Decision: the proposal in 3-5 sentences plus the constraints it has to satisfy
- Assertion: the claim plus the evidence that supposedly supports it

Strip your reasoning. If you hand over conclusions, you'll get back validation of your conclusions. The unit must be small enough that a reviewer can hold it in mind in one read.

### Step 3: DOUBT - Invoke the fresh-context reviewer

Spawn a subagent with an **adversarial** prompt. Framing decides the answer.

```
Adversarial review. Find what is wrong with this artifact.
Assume the author is overconfident. Look for:
- Unstated assumptions
- Edge cases not handled
- Hidden coupling or shared state
- Ways the contract could be violated
- Existing conventions this might break
- Failure modes under unexpected input

Do NOT validate. Do NOT summarize. Find issues, or state
explicitly that you cannot find any after thorough examination.

ARTIFACT: <paste artifact>
CONTRACT: <paste contract>
```

**Pass ARTIFACT + CONTRACT only. Do NOT pass the CLAIM.** Handing the reviewer your conclusion biases it toward agreement. The reviewer must independently determine whether the artifact satisfies the contract.

#### Cross-model escalation (interactive sessions only)

After the single-model review, offer the user a cross-model second opinion:

> *"Single-model review complete. Want a cross-model second opinion? Options: Gemini CLI, Codex CLI, manual external review, or skip."*

This question is mandatory in every interactive doubt cycle. The user decides whether the cost is worth it.

If the user picks a CLI:
1. Check the tool is in PATH (`which gemini`, `which codex`)
2. Test it works before passing the full prompt
3. Write the prompt to a temp file and pipe via stdin (never inline shell-quoted; code contains backticks and `$(...)` that will execute)
4. Pass ARTIFACT + CONTRACT + adversarial prompt only. No session context, no CLAIM
5. Use a read-only sandbox flag to prevent the cross-model CLI from modifying the workspace

In non-interactive contexts (CI, `/loop`, autonomous runs): skip cross-model and announce the skip.

### Step 4: RECONCILE - Fold findings back

The reviewer's output is data, not verdict. **You are still the orchestrator.** Re-read the artifact against each finding before classifying.

For each finding, classify in **precedence order** (first matching class wins):

1. **Contract misread** - reviewer flagged something because the CONTRACT was unclear. Fix the contract first, re-classify on the next cycle.
2. **Valid + actionable** - real issue requiring a change to the artifact. Change it, re-loop.
3. **Valid trade-off** - issue is real but cost of fixing exceeds cost of accepting. Document the trade-off explicitly.
4. **Noise** - reviewer flagged something that's correct under context the reviewer didn't have. Note it.

A fresh reviewer can be wrong because it lacks context. Don't defer just because it's "fresh."

### Step 5: STOP - Bounded loop, not recursion

Stop when:

- Next iteration returns only trivial or already-considered findings, **or**
- 3 cycles completed (escalate to user, don't grind a fourth alone), **or**
- User explicitly says "ship it"

If after 3 cycles the reviewer still surfaces substantive issues, the artifact may not be ready. Surface this to the user; three unresolved cycles is information about the artifact, not a reason to keep looping.

## Progress Checklist

- [ ] Step 1: CLAIM - wrote the claim + why-it-matters
- [ ] Step 2: EXTRACT - isolated artifact + contract, stripped reasoning
- [ ] Step 3: DOUBT - invoked fresh-context reviewer with adversarial prompt
- [ ] Step 4: RECONCILE - classified every finding against the artifact text
- [ ] Step 5: STOP - met stop condition (trivial findings, 3 cycles, or user override)

## Interaction with Other Skills

- **`code-review` / `/review`**: complementary. `/review` is post-hoc PR verdict; doubt-driven is in-flight per-decision. Use both.
- **`tdd`**: TDD's RED step is doubt made concrete. A failing test is a disproof attempt. When TDD applies, that failing test *is* the doubt step for behavioral claims.
- **`debugging`**: when the reviewer surfaces a real failure mode, drop into the debugging skill to localize and fix.
- **`security-deep-dive`**: for security-specific claims, the security-deep-dive skill provides deeper domain coverage than a generic doubt cycle.

## Red Flags

- Spawning a fresh-context reviewer for a one-line rename
- Treating reviewer output as authoritative without re-reading the artifact
- Looping >3 cycles without escalating to the user
- Prompting the reviewer with "is this good?" instead of "find issues"
- Skipping doubt under time pressure on a high-stakes decision
- Passing the CLAIM to the reviewer (biases toward agreement)
- Silently skipping cross-model in an interactive session
- **Doubt theater**: across 2+ cycles where the reviewer surfaced substantive findings, zero findings were classified as actionable. You are validating, not doubting. Stop and escalate.
