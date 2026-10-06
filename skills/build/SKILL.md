---
name: build
description: Implement tasks incrementally; build, test, verify, commit. Add "auto" to run the whole plan in one approved pass.
user-invocable: true
allowed-tools: Read Grep Glob Bash Edit Write
metadata:
  author: Saturate
  version: "1.0"
---

Invoke the `incremental-implementation` skill alongside `tdd`.

## Modes

- **`/build`** -- implement the *next* pending task, then stop (one slice at a time).
- **`/build auto`** -- generate the plan if needed, get a single approval, then implement *every* task without stopping between them.

`$ARGUMENTS` selects the mode. Treat `auto` or `all` as autonomous mode; anything else (or empty) is the default single-task mode. Autonomous mode is not faster *per task*; it runs the same test-driven loop but removes the human stepping *between* tasks.

## Default: one task

Resolve `$dir` as described in the `spec` skill ("Where specs live"). Archive merged features (spec skill, "Archiving merged work"), then list `~/.claude/specs/$repo/` excluding `done/`: one feature folder means use it; several means ask the user which one (suggest the one matching the current branch name if any). A plan (`$dir/plan.md`) must exist. If none exists, stop and ask the user to run `/plan` first.

Pick the next pending task from `$dir/plan.md`. Then:

1. If `$dir/BRANCH` doesn't exist, write the current branch name to it (used to archive the folder after merge)
2. Read the task's acceptance criteria
3. Load relevant context (existing code, patterns, types)
4. Write a failing test for the expected behavior (RED)
5. Implement the minimum code to pass the test (GREEN)
6. Run the full test suite to check for regressions
7. Run the build to verify compilation
8. Commit with a descriptive message (invoke the `commit` skill)
9. Mark the task complete and stop

## Autonomous: the whole plan (`/build auto`)

Removes the manual stepping between tasks, **not** the verification. Every task still earns a passing test and its own commit.

### 1. Require a spec

Resolve `$dir` as in the default mode and look for `$dir/SPEC.md`. A README or arbitrary doc in the repo does **not** count. If none exists, stop and ask the user to run `/spec` first. Do not invent requirements.

### 2. Establish a clean baseline

Run `git status --porcelain`. If there are any uncommitted changes, stop and ask the user to commit, stash, or confirm how to handle them. Autonomous per-task commits must not absorb unrelated local work, or the clean-rollback guarantee breaks.

### 3. Plan if needed

If there is no `$dir/plan.md`, invoke the `/plan` workflow to generate one.

### 4. Single checkpoint

Present the full plan and wait for an unambiguous affirmative (e.g. "approve", "go", "yes"). Treat hedged responses ("looks reasonable", "I guess") as **not** approved. This is the only human gate; after approval, run autonomously.

### 5. Execute every task in dependency order

Use each task's declared dependencies; if not explicit, execute in the order the plan lists them. For each task, run the full default loop above (RED, GREEN, regression, build, commit, mark complete).

Stage only the files that task touched. Task-status updates go to `$dir/plan.md`, which is outside the repo and never staged. Never `git add -A` blindly. Make one commit per task so any point is a clean rollback.

### 6. Stop and ask the user (do not push through) when

- A test can't be made to pass or the build breaks without an obvious fix. Follow the `debugging` skill.
- The spec is ambiguous, or a task needs a decision the spec doesn't cover.
- A task is **high-risk or irreversible**: auth/permission changes, destructive data migrations, payments, deletions, deploys, anything touching secrets, **or anything you can't undo with `git revert`**. Get explicit sign-off before continuing.

After the user resolves a blocker, they re-invoke `/build auto`; it resumes from the next pending task.

### 7. Summarize at the end

Tasks completed, tests added, commits made, and anything skipped, flagged, or left for the user.

## Rules

1. **The codebase is always working between tasks.** If a task breaks something, fix it before the next.
2. **Don't mix tasks.** If you notice something for task 4 while implementing task 2, note it and keep going.
3. **If a task is too big, split it further.** If you can't implement, test, and verify in reasonable scope, it's not small enough.
4. **Feature flags for incomplete work.** If the feature needs multiple PRs, keep incomplete functionality hidden from users.

If any step fails, follow the `debugging` skill.
