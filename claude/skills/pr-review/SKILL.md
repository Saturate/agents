---
name: pr-review
description: Performs comprehensive code reviews checking for bugs, security issues, performance problems, testing gaps, and code quality. Accepts branch names or PR URLs (GitHub/Azure DevOps) to automatically checkout and review. Use when reviewing PRs, pull requests, code changes, commits, diffs, or when asked to review code, check code, audit changes, review my changes, check PR, review branch, or perform code review.
compatibility: Basic tools - grep, file reading. Optional: gh CLI for GitHub PRs, az CLI for Azure DevOps PRs
allowed-tools: Read Grep Glob Bash
metadata:
  author: Saturate
  version: "2.0"
---

# Code Review

Review code like a senior engineer - thorough but practical. Focus on things that actually matter. Don't waste time on style nitpicks a linter should catch.

## Arguments

The skill accepts optional arguments to determine what to review:

**No arguments:** Ask user if they want to review the current branch

**Branch name:** Checkout the branch and review it
- Example: `/pr-review feat/redirect`
- Example: `/pr-review feature/add-auth`

**PR URL:** Supports GitHub and Azure DevOps PR URLs
- Example: `/pr-review https://github.com/owner/repo/pull/123`
- Example: `/pr-review https://dev.azure.com/org/project/_git/repo/pullrequest/456`
- Platform-specific integration details are in reference files (loaded only when needed)

## Step 0: Determine What to Review

**If no arguments provided:**
1. Check current git branch: `git branch --show-current`
2. Ask user: "Review current branch `{branch-name}`?" (Yes/No)
3. If No, ask: "Which branch or PR URL should I review?"
4. Proceed based on response

**If arguments provided:**

**1. Detect if URL:**
```bash
if [[ "$args" =~ ^https?:// ]]; then
  # It's a URL, determine platform
  if [[ "$args" =~ github\.com ]]; then
    # GitHub PR detected - READ references/github-pr-integration.md for implementation
    # Follow the complete workflow in that file to:
    # - Extract owner, repo, PR number from URL
    # - Use gh CLI to get branch name
    # - Checkout branch for review
  elif [[ "$args" =~ dev\.azure\.com|visualstudio\.com ]]; then
    # Azure DevOps PR detected - READ references/azure-pr-integration.md for implementation
    # Follow the complete workflow in that file to:
    # - Extract org, project, repo, PR number from URL
    # - Use az CLI to get branch name
    # - Checkout branch for review
  else
    echo "❌ Unsupported PR URL. Supports GitHub and Azure DevOps only."
    exit 1
  fi
fi
```

**2. If not URL, treat as branch name:**
```bash
# Fetch latest changes
git fetch origin

# Checkout branch
if git rev-parse --verify "$args" &> /dev/null; then
  git checkout "$args"
  git pull origin "$args"
else
  git checkout -b "$args" "origin/$args" 2>/dev/null || {
    echo "❌ Branch '$args' not found locally or on remote"
    exit 1
  }
fi
```

**3. Verify we're on a branch (not detached HEAD):**
```bash
current_branch=$(git branch --show-current)
if [ -z "$current_branch" ]; then
  echo "❌ Detached HEAD state - cannot review"
  exit 1
fi
```

## Review Checklist

Use this checklist to guide your review. Need examples of what to look for? Check out [references/common-issues.md](references/common-issues.md) for code patterns.

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

Structure your review like this (see [references/review-template.md](references/review-template.md) for detailed examples):

- **Summary:** One line verdict (Good to merge / Has issues / Needs work)
- **Critical:** Security, data loss, crashes - must fix before merge
- **Important:** Bugs, performance, missing tests - should fix
- **Minor:** Quality improvements - nice to have
- **Questions:** Things to clarify with the author
- **Prevent This:** Suggest tooling/config to catch these issues automatically in the future
- **Positive Notes:** Briefly acknowledge what's done well

## Guidelines

- Be specific: file:line, what's wrong, why it matters, how to fix
- Skip style issues that linters catch
- Explain impact, not just "this is wrong"
- Consider trade-offs - sometimes simple is better than perfect
- Briefly note if something is done well, but keep it short

### Suggesting Future Mitigations

Only suggest mitigations for recurring patterns or critical issues. Don't suggest tools for one-off mistakes. Focus on automatable checks, not process changes.

**TypeScript configuration:**
- Type safety issues (`any`, implicit types) → Suggest `strict: true`, `noImplicitAny`, `strictNullChecks` in tsconfig.json
- Missing null checks → Suggest `strictNullChecks: true`

**Linting rules:**
- Code quality patterns ESLint could catch → Suggest specific ESLint rules
- Framework-specific issues → Suggest framework ESLint plugins (react-hooks, vue, etc.)
- Formatting inconsistencies → Suggest Prettier in pre-commit hook

**Pre-commit hooks:**
- Secrets/credentials committed → Suggest trufflehog or git-secrets
- Test failures → Suggest running tests before commit
- Type errors → Suggest tsc --noEmit check

**CI/CD checks:**
- Security vulnerabilities → Suggest npm audit / dependency scanning
- Missing tests → Suggest coverage thresholds
- Build errors → Ensure build runs in CI

## References

Need more guidance? Check these out:

- **[Review Template](references/review-template.md)** - What your review output should look like, with severity categories and example issues
- **[Common Issues](references/common-issues.md)** - Quick reference of problems that come up often in reviews, with good/bad code examples
