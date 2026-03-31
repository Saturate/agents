---
name: tdd
description: Guides test-driven development with RED-GREEN-REFACTOR cycle, prove-it pattern for bugs, and consumer-driven interface testing. Prefers real implementations over mocks. Use when writing tests first, TDD, test driven development, red green refactor, prove a bug, writing tests, test first, or when asked to add tests before implementation.
allowed-tools: Read Grep Glob Bash
metadata:
  author: Saturate
  version: "1.0"
---

# Test-Driven Development

Try to write the test first. Not always possible, but always the goal.

## Progress Checklist

- [ ] Detect test framework and patterns
- [ ] Write failing test (RED)
- [ ] Write minimal code to pass (GREEN)
- [ ] Refactor with tests green (REFACTOR)
- [ ] Repeat for next behavior

## Step 0: Detect Test Framework

```bash
# Check project for test setup
cat package.json 2>/dev/null | grep -E "jest|vitest|mocha|testing"
ls *test* *spec* **/*.test.* **/*.spec.* 2>/dev/null | head -10
cat go.mod 2>/dev/null | grep testing
ls *_test.go 2>/dev/null | head -5
```

Match the project's existing patterns: test location, naming convention, setup/teardown approach.

## The Cycle

### RED: Write a Failing Test

Write a test that describes the behavior you want. Run it. It should fail.

If it passes without you writing any implementation, either:
- The behavior already exists (check before writing)
- The test is wrong (it's testing nothing useful)

The test name should describe the behavior, not the implementation:
- Good: `should reject expired tokens`
- Bad: `test validateToken function`

### GREEN: Make It Pass

Write the **minimum** code to make the test pass. Don't over-engineer. Don't add features the test doesn't require. This feels wrong but it's the point - the tests drive what gets built.

### REFACTOR: Clean Up

With all tests green, improve the code:
- Remove duplication
- Improve naming
- Simplify logic
- Extract patterns

Run tests after each change. If a test breaks during refactoring, you changed behavior, not just structure.

## Prove-It Pattern (Bugs)

When fixing a bug:

1. **Write a test that reproduces the bug** - this test should FAIL with the current code
2. Confirm it fails for the right reason
3. Fix the bug
4. Confirm the test passes
5. Run the full suite to ensure no regressions

This guarantees the bug is actually fixed and won't come back.

## Consumer-Driven Interface Design

When designing an interface (API, class, module):

1. Write the test as if you're the consumer calling the interface
2. Does it feel natural to use? Are there too many arguments? Are defaults sane?
3. If the test is awkward to write, the interface is awkward to use - fix the interface

The test is your first consumer. If it's painful to set up, real consumers will suffer too.

## Mocking Rules

**Only mock external boundaries:**
- Third-party HTTP APIs
- Database (when unit testing, not integration testing)
- File system
- Time/dates
- Email/SMS services

**Never mock:**
- The thing you're testing
- Your own internal modules (if you need to mock them, your design has coupling issues)
- Simple utilities or pure functions

**If a test can't run without mocking your own code, that's a design smell.** The test is telling you the code is too coupled. Fix the design, don't add mocks.

## Security Test Patterns

When building auth or input handling, include tests for:

- Auth bypass: accessing protected resources without credentials
- IDOR: accessing another user's data by changing IDs
- Input validation: SQL injection, XSS payloads, oversized inputs
- Rate limiting: repeated failed auth attempts
- Missing authorization: authenticated but not authorized for this action

## Anti-Patterns

- Writing tests after the code "just to hit coverage" - tests should drive design, not chase metrics
- Testing implementation details (internal state, private methods, call counts)
- Tests that pass when the thing they test is deleted (testing the mock)
- Shared mutable state between tests (tests depend on execution order)
- Tests with no assertions (they always pass, proving nothing)
