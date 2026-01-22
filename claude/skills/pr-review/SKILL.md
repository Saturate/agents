---
name: pr-review
description: Performs comprehensive code reviews checking for bugs, security issues, performance problems, testing gaps, and code quality. Use when reviewing PRs, code changes, or when asked to review code.
allowed-tools: Read, Grep, Glob, Bash
---

# Code Review

Review code like a senior engineer - thorough but practical. Focus on things that actually matter. Don't waste time on style nitpicks a linter should catch.

## Review Checklist

### Security (Critical)
- [ ] Input validation and sanitization
- [ ] SQL injection, XSS, command injection risks
- [ ] Auth checks in place and correct
- [ ] Sensitive data handling (passwords, tokens, PII)
- [ ] Dependency vulnerabilities

### Bugs & Logic (Critical)
- [ ] Null/undefined handling
- [ ] Edge cases (empty arrays, null values, boundaries)
- [ ] Error handling in place
- [ ] Race conditions or concurrency issues
- [ ] State management issues

### Performance (Important)
- [ ] Algorithm complexity (watch for O(n²) where O(n) exists)
- [ ] N+1 query problems
- [ ] Memory leaks (listeners, subscriptions, closures)
- [ ] Blocking operations that should be async

### Testing (Important)
- [ ] Changes covered by tests
- [ ] Tests verify actual behavior
- [ ] Edge cases tested
- [ ] Error conditions tested

### Code Quality
- [ ] Code is understandable
- [ ] No unnecessary complexity or clever code
- [ ] Duplication worth extracting
- [ ] Names match what they do

### Architecture
- [ ] Fits existing patterns (or has good reason not to)
- [ ] No breaking changes without migration
- [ ] Avoids unnecessary coupling

## Output Format

```markdown
## Summary
[One line: Good to merge / Has issues / Needs work]

## Critical
[Security, data loss, crashes - must fix]

## Important
[Bugs, performance, missing tests - should fix]

## Minor
[Quality improvements - nice to have]

## Questions
[Things to clarify]
```

## Guidelines

- Be specific: file:line, what's wrong, why it matters, how to fix
- Skip style issues that linters catch
- Explain impact, not just "this is wrong"
- Consider trade-offs - sometimes simple is better than perfect
- Briefly note if something is done well, but keep it short
