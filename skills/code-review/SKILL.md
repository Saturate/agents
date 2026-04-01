---
name: code-review
description: Performs self-review during development by checking changed code for bugs, security issues, performance problems, and test gaps. Runs inline before committing or creating PRs. Use when reviewing own code, self-review, check my changes, review before commit, review my code, code review, quality check, or when triggered by incremental-implementation before a PR.
allowed-tools: Read Grep Glob Bash
metadata:
  author: Saturate
  version: "1.0"
---

# Code Review

Review your own code like a senior engineer would review someone else's. Catch issues before they become PR comments.

## Progress Checklist

- [ ] Get the diff
- [ ] Detect tech stack
- [ ] Review for correctness
- [ ] Review for security
- [ ] Review for performance
- [ ] Check test coverage
- [ ] Report findings

## Step 0: Get the Diff

```bash
# If reviewing staged changes
git diff --cached

# If reviewing branch changes
git diff main...HEAD

# Overview first
git diff --cached --stat
```

## Step 1: Detect Tech Stack

Check changed files to determine which review patterns apply:

- `.ts`, `.tsx`, `.js`, `.jsx` - Load TypeScript/JavaScript patterns
- `.cs`, `.csproj` - Load .NET patterns
- `.go` - Load Go patterns
- `.vue` - Load Vue patterns

Load relevant issue references:
- `../pr-review/references/issues-general.md` - Always
- `../pr-review/references/issues-typescript.md` - If TS/JS files changed
- `../pr-review/references/issues-dotnet.md` - If .NET files changed
- `../pr-review/references/issues-go.md` - If Go files changed

Also load shared references:
- `../_shared/security-checklist.md`
- `../_shared/performance-anti-patterns.md`

## Step 2: Review for Correctness

For each changed file:

- Does the logic actually do what it's supposed to?
- Edge cases: null/undefined, empty collections, boundary values, concurrent access
- Error handling: are errors caught where they should be? Are they swallowed silently?
- Type safety: any type assertions, unchecked casts, `any` types?
- State management: race conditions, stale closures, missing cleanup

## Step 3: Review for Security

Apply security checklist from shared references:

- Input validation at boundaries
- No SQL/command/HTML injection vectors
- Auth checks on protected operations
- Sensitive data not logged or exposed in errors
- No secrets in the diff

## Step 4: Review for Performance

Apply performance patterns from shared references:

- N+1 queries in new data access code
- Missing pagination on list operations
- Unnecessary re-renders in frontend components
- Large objects passed where smaller projections would work
- Missing async/await on I/O operations

## Step 5: Check Test Coverage

- New behavior should have tests
- Bug fixes should have regression tests
- Are tests testing real behavior or just mocking everything?
- Any tests that test the mock instead of the actual code?

## Step 6: Report Findings

Categorize findings by severity:

| Severity | Meaning | Action |
|----------|---------|--------|
| **Critical** | Bug, security hole, data loss risk | Must fix before commit |
| **Important** | Logic issue, missing validation, test gap | Should fix |
| **Nit** | Style, naming, minor improvement | Optional, mention briefly |

For each finding:
1. Which file and what the issue is
2. Why it matters
3. Suggested fix

If no issues found, say so briefly. Don't invent problems.

After reporting, offer to fix the issues found.
