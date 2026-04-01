---
name: incremental-implementation
description: Builds features in vertical slices where each slice is implemented, tested, verified, and committed before moving to the next. Triggers code-review before creating PRs and make-pr when complete. Use when implementing a feature, building incrementally, vertical slices, step by step implementation, building a feature, or when starting to code a planned feature.
allowed-tools: Read Grep Glob Bash
metadata:
  author: Saturate
  version: "1.0"
---

# Incremental Implementation

Build one working slice at a time. Never do everything in one pass.

## Progress Checklist

- [ ] Break work into vertical slices
- [ ] For each slice: implement, test, verify, commit
- [ ] Codebase always in working state between slices
- [ ] Self-review before PR (trigger code-review)
- [ ] Create PR (trigger make-pr)

## What's a Vertical Slice?

A slice delivers a working increment of user-facing behavior, cutting through all layers:

**Good slices** (vertical - end to end):
- "User can log in with email and password"
- "Dashboard shows a list of projects"
- "API returns paginated search results"

**Bad slices** (horizontal - one layer only):
- "Add auth middleware" (no endpoint uses it yet)
- "Create database schema" (no code reads from it yet)
- "Build the form component" (no API to submit to)

Each slice should be deployable on its own, even if the full feature isn't complete.

## How to Slice

1. Start with the simplest end-to-end path (happy path)
2. Add error handling and edge cases as subsequent slices
3. Add optimization and polish as final slices

Example for "user registration":
1. Slice 1: Form submits, API creates user, returns success
2. Slice 2: Input validation (client and server)
3. Slice 3: Email verification flow
4. Slice 4: Error handling (duplicate email, network failure)
5. Slice 5: Loading states, success feedback, redirect

## The Loop

For each slice:

### 1. Implement
Write the minimum code for this slice. Don't half-implement the next slice while you're at it.

### 2. Test
Write or update tests for this slice. Follow `tdd` skill patterns:
- Test behavior, not implementation
- Real implementations over mocks
- If fixing a bug, write the failing test first

### 3. Verify
```bash
# Run the test suite
npm test          # or go test ./... or dotnet test

# Check types
tsc --noEmit      # or equivalent

# Run the app and check manually if it's a UI change
```

If anything fails, fix it before moving to the next slice.

### 4. Commit
Trigger the `commit` skill. Each slice gets its own commit:
- Atomic: one logical change per commit
- Working: tests pass at every commit
- Descriptive: commit message explains the slice

## After All Slices

### Self-Review
Trigger the `code-review` skill to review the full set of changes:
- Look at the branch diff as a whole
- Catch issues that are only visible in the bigger picture
- Fix anything found before creating the PR

### Create PR
If self-review passes, trigger the `make-pr` skill.

If self-review finds issues, fix them (another slice through the loop), then create the PR.

## Rules

1. **The codebase is always working between slices.** If a slice breaks something, fix it before moving on. Don't accumulate broken state across slices.

2. **Don't mix slices.** If you're implementing slice 2 and notice something for slice 4, note it and keep going. Don't start slice 4 in the middle of slice 2.

3. **If a slice is too big, split it further.** If you can't implement, test, and verify a slice in a reasonable amount of work, it's not small enough.

4. **Feature flags for incomplete work.** If the feature needs multiple PRs to complete, use a feature flag or branch to keep incomplete functionality hidden from users.

## When to Skip This

Not everything needs slicing:
- Single-file bug fix: just fix it, test it, commit it
- Config change: just change it
- Small refactor: one change, one commit

Use this skill for multi-step features, not for everything.
