---
name: debugging
description: Systematic debugging workflow that follows evidence instead of guessing. Checks APM and monitoring first, gathers context through available tools, localizes to layer, and tracks what has been tried to prevent loops. Use when debugging, fixing a bug, something is broken, error investigation, troubleshooting, diagnosing issues, finding root cause, or when stuck on a problem.
allowed-tools: Read Grep Glob Bash WebSearch
metadata:
  author: Saturate
  version: "1.0"
---

# Debugging

Stop guessing. Follow the evidence.

## Progress Checklist

- [ ] Read the actual error
- [ ] Check for monitoring/APM data
- [ ] Gather context
- [ ] Localize to a layer
- [ ] Track hypotheses and attempts
- [ ] Fix root cause
- [ ] Check for the pattern elsewhere
- [ ] Guard with regression test

## Step 0: Read the Error

Actually read it. The full message, the stack trace, the error code. Most bugs tell you exactly what's wrong if you read carefully.

```bash
# If there's a log file
tail -100 /path/to/log

# If there's a build error, read the first error (not the cascade)
```

## Step 1: Check Monitoring

Before adding console.logs everywhere, check if the answer already exists:

- **Sentry / error tracking**: full stack trace, breadcrumbs, user context
- **Application Insights / DataDog / NewRelic**: request traces, dependency calls, performance data
- **Logging service**: structured logs with correlation IDs
- **Browser DevTools**: console errors, network failures, performance traces

Ask the user: "Is there APM or error tracking configured? Sentry, Application Insights, DataDog?"

If monitoring exists, start there. If not, proceed to manual investigation.

## Step 2: Gather Context

Build a picture of what's happening:

```bash
# What changed recently?
git log --oneline -10

# Who last touched this area?
git log --oneline -5 -- path/to/relevant/file

# Can we reproduce it?
# Try to run the failing scenario locally
```

If you can't reproduce it, consider:
- Environment differences (dev vs staging vs prod)
- Timing/race conditions
- State-dependent (specific data, specific user, specific config)
- Browser/OS-specific

## Step 3: Localize to a Layer

Where is the bug actually happening?

| Symptom | Likely layer |
|---------|-------------|
| UI renders wrong | Frontend component logic or state |
| API returns wrong data | Backend controller/service logic |
| API returns 500 | Backend exception, check logs |
| API returns 401/403 | Auth/authz middleware |
| Slow response | Database query or external service |
| Works locally, fails in CI | Environment config or dependency issue |
| Intermittent failures | Race condition, timing, flaky test |

Narrow down to the specific layer before diving into code. Don't read every file.

## Step 4: Track What You've Tried

**This is critical for preventing loops.** Keep a running log:

```
## Investigation Log
1. Hypothesis: [what you think is wrong]
   Tried: [what you did to test it]
   Result: [what happened]
   Conclusion: [confirmed/rejected, what we learned]

2. Hypothesis: ...
```

If you've tried 3 things and none worked, step back and re-read the error. You may be looking at the wrong layer.

## Step 5: Research

If the error isn't obvious:

- Search the error message (exact match, then keywords)
- Check git history: `git log --all -S "keyword"` to find when something was added/changed
- Check memories for similar past issues
- Check project issues/bugs (GitHub Issues, Azure DevOps work items)
- Web search for the specific error message + framework

## Step 6: Fix the Root Cause

Fix the actual cause, not the symptom:

- **Symptom fix**: adding a try-catch to hide an error
- **Root cause fix**: fixing why the error happens in the first place

If you're not sure what the root cause is, don't guess. Add targeted instrumentation (logging, debugger breakpoints) and reproduce again.

## Step 7: Check for the Pattern

After finding the bug, ask: does this pattern exist elsewhere?

Trigger the `hunting-bugs` skill or manually search:

```bash
# Search for similar patterns in the codebase
grep -rn "similar_pattern" --include="*.ts" --include="*.cs" --include="*.go"
```

## Step 8: Guard Against Regression

Write a test that:
1. Reproduces the bug (fails without the fix)
2. Passes with the fix

This is the prove-it pattern from the `tdd` skill. The test guarantees this specific bug can't come back silently.

## When to Ask for Help

If after 3 solid hypotheses you're still stuck:
- Summarize what you've tried and what you've learned
- Ask the user for more context (environment details, reproduction steps, access to monitoring)
- Don't keep trying random things
