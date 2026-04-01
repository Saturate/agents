---
name: code-simplification
description: Simplifies code safely using Chesterton's Fence principle - understanding why code exists before changing it. Makes one change at a time with verification after each. Use when simplifying code, reducing complexity, refactoring, cleaning up, making code simpler, untangling, or when code feels unnecessarily complex.
allowed-tools: Read Grep Glob Bash
metadata:
  author: Saturate
  version: "1.0"
---

# Code Simplification

Simpler code isn't fewer lines. It's code that's easier to read, understand, and change.

## Progress Checklist

- [ ] Understand why the code exists (Chesterton's Fence)
- [ ] Define scope of simplification
- [ ] Make one change at a time
- [ ] Verify after each change
- [ ] Ensure project conventions are followed

## Step 0: Chesterton's Fence

Before removing or rewriting anything, understand why it exists.

```bash
# Who wrote this and when?
git blame path/to/file

# What was the commit about?
git log --oneline -5 -- path/to/file

# Was there a PR? What was the context?
git log --format="%H %s" -5 -- path/to/file
```

Look for:
- Linked work items or issue numbers in commit messages
- PR descriptions explaining the reasoning
- Comments explaining workarounds (browser quirks, API limitations, business rules)
- Tests that depend on this specific behavior

**If you don't understand why something is there, don't remove it.** Ask first.

## Step 1: Define Scope

Only simplify what was requested or what you're currently working on.

Don't:
- Simplify unrelated code you noticed while passing through
- Combine simplification with feature work in the same change
- "Improve" code style to your personal preference over project conventions

## Step 2: One Change at a Time

Each simplification should be a single, reviewable change:

1. Make the change
2. Run tests: `npm test`, `go test ./...`, `dotnet test`, etc.
3. Check types: `tsc --noEmit`, `go vet`, etc.
4. If tests pass, move to the next simplification
5. If tests fail, your change altered behavior - revert and reconsider

## Common Simplification Opportunities

### Structural
- Deeply nested if/else that can be flattened with early returns
- Large functions that do multiple things (extract smaller functions)
- Duplicated logic that can be extracted (but only if used 3+ times)
- Complex conditionals that can be named variables: `const isEligible = age >= 18 && hasConsent`

### Unnecessary Complexity
- Abstractions with a single implementation (remove the interface, keep the implementation)
- Config/options for things that are never configured differently
- "Just in case" error handling for impossible states
- Wrapper functions that just pass through to another function

### Readability
- Magic numbers that should be named constants
- Boolean parameters that make call sites unreadable
- Overly clever one-liners that are hard to debug

## What NOT to Simplify

- Error handling that looks redundant but covers real edge cases
- "Verbose" code that's actually clear and easy to debug
- Framework boilerplate that other developers expect to see
- Performance-critical code that's optimized intentionally (check git blame)
- Code you don't fully understand yet

## Anti-Patterns

- Removing error handling to "simplify"
- Premature abstraction: extracting a helper for something used once
- "Simplifying" by using clever language features that obscure intent
- Mixing refactoring with behavior changes
- Simplifying someone else's code without understanding the context
