---
name: pr-review
description: Performs comprehensive code reviews checking for bugs, security issues, performance problems, testing gaps, and code quality. Accepts branch names or PR URLs (GitHub/Azure DevOps) to automatically checkout and review. Supports a loop mode that reviews with a fresh subagent, fixes findings, and repeats until clean. Use when reviewing PRs, pull requests, code changes, commits, diffs, or when asked to review code, check code, audit changes, review my changes, check PR, review branch, review until clean, or perform code review.
compatibility: Basic tools - grep, file reading. Optional: gh CLI for GitHub PRs, az CLI for Azure DevOps PRs
allowed-tools: Read Grep Glob Bash Task
argument-hint: "[loop] [branch-name or PR URL]"
metadata:
  author: Saturate
  version: "3.4"
---

# Code Review

Thorough but practical. Focus on what matters. Skip style nitpicks linters catch.

## Arguments

**No arguments:** Ask user if they want to review the current branch.

**Branch name:** `/pr-review feat/redirect`

**PR URL:** `/pr-review https://github.com/owner/repo/pull/123` or Azure DevOps equivalent. Platform-specific details in reference files.

**`loop`:** Review-fix cycle with fresh subagents. See [Loop Mode](#loop-mode).
- `/pr-review loop` | `/pr-review loop feat/redirect` | `/pr-review loop --model sonnet`

## Loop Mode

Review-fix cycle for changes this session authored. The review runs in a **fresh subagent** each round because a reviewer sharing the author's context anchors on its own reasoning. The main agent orchestrates and fixes; it never reviews.

**Roles:**
- **Subagent (reviewer):** reads diff cold, reports findings, changes nothing.
- **Main agent (fixer):** runs gates, spawns reviewer, applies fixes, commits.

**Setup (once):**
1. Resolve what to review per Step 1. Skip checkout if already on the branch.
2. Run quality gates (Step 2c) and fix failures first.

**Each iteration (max 5):**

1. Spawn a fresh subagent via Task tool, model `opus` unless `--model` overrides. Never reuse a prior reviewer.
2. Subagent prompt:
   - Follow Steps 0, 2, 2b. Skip Steps 1 and 2c. Read-only.
   - Accepted-findings list from prior iterations as "deliberate decisions, do not re-flag".
   - Output: standard Output Format, ending with `VERDICT: CLEAN` (no Critical/Important) or `VERDICT: FINDINGS`.
3. `VERDICT: CLEAN` → stop, report iterations and fixes.
4. `VERDICT: FINDINGS`:
   - Fix Critical and Important findings.
   - Minor: fix if trivial, otherwise add to accepted-findings with reason.
   - Wrong or guideline-conflicting findings: add to accepted-findings with reason.
   - Re-run affected gates. Amend if not pushed; otherwise new commit via `commit` skill.

**Stop conditions:** Clean verdict. Ping-pong (reverses a prior fix) → stop, present both positions. 5 iterations without clean → stop, report remaining.

Loop mode is local only. Never post reviews externally from the loop.

## Step 0: Read Project Guidelines

Scan for project-specific rules before reviewing:

1. `CLAUDE.md` or `AGENT.md` in repo root
2. Global guidelines at `~/.claude/CLAUDE.md`
3. `README.md` and `docs/` for coding standards

These become additional checklist items. Flag violations as Important or Critical.

## Step 1: Determine What to Review

**Save current state first:**
```text
original_branch=$(git branch --show-current)
git stash push -m "pr-review: temporary stash" 2>/dev/null && stashed=true || stashed=false
```

**No arguments:** Ask user to confirm current branch or specify another.

**URL argument:** Detect platform from URL:
- `github.com` → read [references/github-pr-integration.md](references/github-pr-integration.md)
- `dev.azure.com` / `visualstudio.com` → read [references/azure-pr-integration.md](references/azure-pr-integration.md)
- Other → unsupported, exit.

Keep PR metadata (title, description, author, work items) for the PR Quality section.

**Branch argument:**
```text
git fetch origin
git checkout "$args" && git pull origin "$args" ||
  git checkout -b "$args" "origin/$args" || exit 1
```

Verify not in detached HEAD state.

## Step 1b: Delegate if Session Authored the Changes

If this session did any work on the branch (commits, edits, fixes), delegate the review to a fresh subagent. If uncertain, delegate. A reviewer that wrote the code validates its own reasoning.

**Delegate:**
1. Complete Step 1 (checkout, stash).
2. Run Step 2c (quality gates).
3. Spawn a fresh subagent (model `opus` unless overridden) with:
   - Follow Steps 0, 2, 2b, 2d and the Review Checklist. Skip Steps 1 and 2c. Read-only.
   - Gate results from Step 2c.
   - Output: standard Output Format.
4. Present findings to user, proceed to Step 3.

**No session work on the branch:** Review inline (Steps 2 through 3).

## Step 2: Scope the Review to the Diff

Review only what changed, not the whole codebase:

```text
base=$(git remote show origin 2>/dev/null | grep 'HEAD branch' | awk '{print $NF}')
base=${base:-main}

git diff "origin/$base...HEAD"
git diff --name-only "origin/$base...HEAD"
git log "origin/$base...HEAD" --oneline
```

Only read files from `git diff --name-only`. Read surrounding context only when the diff isn't enough.

## Step 2b: Detect Tech Stack and Load Relevant Issues

Load issue references based on file extensions in the diff:

| Files in diff | Load reference |
|---|---|
| `*.ts`, `*.tsx`, `*.js`, `*.jsx`, `*.vue`, `*.svelte` | [references/issues-typescript.md](references/issues-typescript.md) |
| `*.cs`, `*.csproj`, `*.sln`, `*.razor` | [references/issues-dotnet.md](references/issues-dotnet.md) |
| `*.go`, `go.mod`, `go.sum` | [references/issues-go.md](references/issues-go.md) |
| `*.rs`, `Cargo.toml`, `Cargo.lock` | [references/issues-rust.md](references/issues-rust.md) |
| LLM SDK imports (`openai`, `anthropic`, `langchain`, `@ai-sdk`, `semantic-kernel`) | [../_shared/owasp-llm-top-10.md](../_shared/owasp-llm-top-10.md) |
| Any files | [references/issues-general.md](references/issues-general.md) - always load |

Load multiple if the diff spans stacks.

## Step 2c: Run Project Quality Gates

Run existing project quality tools before manual review:

```bash
cat package.json Cargo.toml go.mod *.csproj Makefile 2>/dev/null | head -100
```

| Stack | Tool | Command |
|---|---|---|
| Rust | clippy | `cargo clippy --all-targets --workspace -- -D warnings` |
| Rust | test | `cargo test --workspace` |
| Rust | audit | `cargo audit` (if installed) |
| TypeScript | tsc | `npx tsc --noEmit` |
| TypeScript | eslint | `npx eslint --no-warn-ignored .` or package.json scripts |
| TypeScript | test | `npm test` or `pnpm test` |
| Go | vet | `go vet ./...` |
| Go | staticcheck | `staticcheck ./...` (if installed) |
| Go | test | `go test ./...` |
| .NET | build | `dotnet build --no-restore` |
| .NET | test | `dotnet test --no-build` |

Only run what's configured. Don't install new tools. Include failures in findings. Note pre-existing failures. Skip e2e unless asked.

## Step 2d: Review Existing Comments (PR URL only)

Fetch existing threads before reviewing:

**GitHub:**
```text
gh api user --jq '.login'
gh pr view $pr_number --repo $owner/$repo --comments
gh api repos/$owner/$repo/pulls/$pr_number/comments
```

**Azure DevOps:**
```text
az ad signed-in-user show --query displayName -o tsv
az repos pr thread list --id $pr_number --organization https://dev.azure.com/$org --project "$project"
```

- **Others' active threads:** Assess validity, note agreement/disagreement for Existing Discussion section.
- **Own active threads:** Skip in Existing Discussion, but check if author addressed the feedback.
- **Resolved threads:** Verify the resolution actually fixed the issue in code. Flag "resolved but not fixed" if not.

## Review Checklist

Use with the language-specific issue references loaded above.

### PR Quality (PR URL only)
- [ ] Clear, descriptive title
- [ ] Description explains WHY
- [ ] Complex changes have context
- [ ] Visual changes have screenshots
- [ ] Breaking changes marked
- [ ] Issues linked (GitHub) or work items linked (Azure DevOps)
- [ ] PR size reasonable (flag >500 lines, suggest splitting mixed concerns)

Skip PR quality checks when reviewing a branch without a PR URL.

For detailed evaluation guidance, see [references/review-template.md](references/review-template.md#evaluating-pr-quality).

### Security (Critical)
- [ ] Input validation and sanitization
- [ ] SQL injection, XSS, command injection
- [ ] Auth checks correct
- [ ] Sensitive data handling (passwords, tokens, PII)
- [ ] Dependency vulnerabilities
- [ ] LLM security (if applicable): prompt injection, output sanitization, tool permissions, rate limiting

### Bugs & Logic (Critical)
- [ ] Null/undefined handling
- [ ] Edge cases (empty arrays, boundaries)
- [ ] Error handling
- [ ] Race conditions / concurrency
- [ ] State management

### Performance (Important)
- [ ] Algorithm complexity (O(n^2) where O(n) exists)
- [ ] N+1 queries
- [ ] Memory leaks (listeners, subscriptions, closures)
- [ ] Blocking ops that should be async

### Testing (Important)
- [ ] Changes covered by tests
- [ ] Tests verify behavior, not implementation
- [ ] Edge cases and error conditions tested

### Code Quality
- [ ] Understandable code
- [ ] No unnecessary complexity
- [ ] Duplication worth extracting
- [ ] Names match intent
- [ ] Follows project guidelines (CLAUDE.md, AGENT.md, README)

### Accessibility (UI changes only)
- [ ] Keyboard accessible interactive elements
- [ ] Meaningful alt text on images
- [ ] Color not sole information channel
- [ ] Form inputs have labels
- [ ] Focus managed after dynamic changes
- [ ] Semantic HTML preferred over ARIA

### Dependencies (if packages changed)
- [ ] New packages justified
- [ ] Actively maintained
- [ ] No known vulnerabilities
- [ ] Acceptable bundle size impact (frontend)

For deeper evaluation, invoke `evaluating-dependencies` on new packages.

### Architecture
- [ ] Fits existing patterns
- [ ] No breaking changes without migration
- [ ] Avoids unnecessary coupling
- [ ] DB migrations safe: non-destructive, backwards-compatible, nullable/defaulted new columns

## Step 3: Follow Up

After presenting the review, offer to:
- **Discuss** findings
- **Fix** issues directly
- **Post** as PR comment (draft first, wait for approval)
- **Switch back** to `{original_branch}`

When done:
```text
git checkout "$original_branch"
[ "$stashed" = "true" ] && git stash pop
```

## Output Format

See [references/review-template.md](references/review-template.md) for detailed examples.

- **Summary:** One line verdict (Good to merge / Has issues / Needs work)
- **PR Quality:** Title, description, screenshots (PR URL only)
- **Existing Discussion:** Respond to active threads (PR URL only)
- **Critical:** Security, data loss, crashes
- **Important:** Bugs, performance, missing tests
- **Minor:** Quality improvements
- **Questions:** Clarifications needed
- **Prevent This:** Tooling/config to catch these automatically
- **Positive Notes:** What's done well (brief)

## Guidelines

- Use exact line numbers from source files, not diff output. Read files to confirm.
- Deep links for PR URL reviews:
  - Azure DevOps: `https://dev.azure.com/{org}/{project}/_git/{repo}/pullrequest/{id}?path={filePath}&line={start}&lineEnd={end}&lineStartColumn=1&lineEndColumn=1&type=2&lineStyle=plain&_a=files`
  - GitHub: `https://github.com/{owner}/{repo}/pull/{id}/files#diff-{hash}L{line}`
- Explain impact, not just "this is wrong".
- Flag project guideline violations as Important or Critical with the source quoted.
- For mitigation suggestions, see [references/review-template.md](references/review-template.md#suggesting-future-mitigations).

**Guideline violation format:**
```markdown
### Important

**3. Violates project guideline**
**File:** `app.vue:28`
**Source:** CLAUDE.md - "Never cast types - always narrow them"
**Issue:** Type assertion bypasses TypeScript safety
**Fix:** Use discriminated union or type guard
```

## References

- **[Review Template](references/review-template.md)** - Output structure, examples, PR quality evaluation, mitigation suggestions
- **[General Issues](references/issues-general.md)** - Security, logic bugs, code quality, DB migrations (always load)
- **[TypeScript Issues](references/issues-typescript.md)** - Type safety, TS/JS patterns, UI/accessibility
- **[.NET Issues](references/issues-dotnet.md)** - C#/.NET patterns, Entity Framework, async
- **[Go Issues](references/issues-go.md)** - Error handling, concurrency, naming, performance
- **[Rust Issues](references/issues-rust.md)** - Unsafe, ownership, serde, async/tokio, integer overflow
