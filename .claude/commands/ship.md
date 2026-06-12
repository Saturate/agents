---
description: Run parallel pre-launch review with code-reviewer, security-auditor, and test-engineer, then synthesize a go/no-go decision.
---

# Ship

`/ship` is a **fan-out orchestrator**. It runs three specialist agents in parallel against the current changes, then merges their reports into a single go/no-go decision with a rollback plan.

## Phase A - Parallel fan-out

Spawn three subagents concurrently using the Agent tool. **Issue all three Agent tool calls in a single assistant turn so they execute in parallel.** Sequential calls defeat the purpose of this command.

Each agent gets the staged changes or recent commits as context:

1. **`code-reviewer`** -- Five-axis review (correctness, readability, architecture, security, performance). Output the standard review template.
2. **`security-auditor`** -- Vulnerability and threat-model pass. Check OWASP Top 10, secrets handling, auth/authz, dependency CVEs. Output the standard audit report.
3. **`test-engineer`** -- Coverage analysis. Identify gaps in happy path, edge cases, error paths, and concurrency scenarios. Output the standard coverage analysis.

Constraints:
- Subagents cannot spawn other subagents. Do not let one persona delegate to another.
- Each subagent gets its own context window and returns only its report.

**Skip the fan-out only if all of the following are true:** the change touches 2 files or fewer, the diff is under 50 lines, and it does not touch auth, payments, data access, or config/env. Otherwise, default to fan-out.

## Phase B - Merge in main context

Once all three reports are back, the main agent (not a sub-persona) synthesizes them:

1. **Code Quality** -- Aggregate Critical/Important findings from `code-reviewer` and any failing tests, lint, or build output. Resolve duplicates between reviewers.
2. **Security** -- Promote any Critical/High `security-auditor` findings to launch blockers. Cross-reference with `code-reviewer`'s security axis.
3. **Performance** -- Pull from `code-reviewer`'s performance axis.
4. **Accessibility** -- If the change includes UI: verify keyboard nav, screen reader support, contrast. Handle directly here.
5. **Infrastructure** -- Env vars, migrations, monitoring, feature flags. Verify directly.
6. **Documentation** -- README, ADRs, changelog. Verify directly.

## Phase C - Decision and rollback

Produce a single output:

```markdown
## Ship Decision: GO | NO-GO

### Blockers (must fix before ship)
- [Source persona: Critical finding + file:line]

### Recommended fixes (should fix before ship)
- [Source persona: Important finding + file:line]

### Acknowledged risks (shipping anyway)
- [Risk + mitigation]

### Rollback plan
- Trigger conditions: [what signals would prompt rollback]
- Rollback procedure: [exact steps]
- Recovery time objective: [target]

### Specialist reports (full)
- [code-reviewer report]
- [security-auditor report]
- [test-engineer report]
```

## Rules

1. The three Phase A agents run in parallel. Never sequentially.
2. Agents do not call each other. The main agent merges in Phase B.
3. The rollback plan is mandatory before any GO decision.
4. If any agent returns a Critical finding, the default verdict is NO-GO unless the user explicitly accepts the risk.
