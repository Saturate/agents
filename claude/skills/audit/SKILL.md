---
name: audit
description: Performs comprehensive codebase audit checking architecture, tech debt, security, test coverage, documentation, dependencies, and maintainability. Use when auditing a project, assessing codebase health, or asked to audit/analyze the entire codebase.
allowed-tools: Read, Grep, Glob, Bash
---

# Codebase Audit

Audit the codebase like you're taking over a project - comprehensive but practical. Focus on what actually matters for maintenance, security, and developer experience.

## Audit Process

### 1. Check Available Tools

Run tool availability checks first:
```bash
command -v trufflehog
command -v npm # or pnpm, yarn, pip, cargo, etc.
```

If any expected tools are missing:
- List missing tools
- Note them in output
- Ask user if they want to continue without them

### 2. Detect Project Type and Run Audits

**Detect package manager:**
- Check for `package-lock.json` → npm
- Check for `pnpm-lock.yaml` → pnpm
- Check for `yarn.lock` → yarn
- Check for `requirements.txt` or `poetry.lock` → pip/poetry
- Check for `Cargo.toml` → cargo
- Check for `go.mod` → go

**Run appropriate audits:**
```bash
# Node.js projects
npm audit --json || pnpm audit --json || yarn audit --json

# Python projects
pip-audit --format json || safety check --json

# Rust projects
cargo audit --json

# Go projects
go list -json -m all | nancy sleuth
```

**Always run trufflehog for secrets:**
```bash
trufflehog filesystem . --json --no-update
```

Parse JSON outputs and integrate findings into audit report.

### 3. Understand the Project

- Check project structure (glob for key directories and files)
- Identify tech stack from detected files
- Look for documentation (README, CONTRIBUTING, docs/)
- Check for CI/CD, linting, testing setup

### 4. Critical Issues (Show Details Immediately)

These must be surfaced with full context:

**Security (from tools + manual review)**
- Secrets found by trufflehog (file:line, type, severity)
- Vulnerable dependencies from npm/pip/cargo audit (package, CVE, severity)
- Hardcoded credentials or API keys in code
- Missing authentication/authorization
- Unsafe data handling patterns
- Exposed sensitive endpoints

**Breaking Problems**
- Build failures or broken configuration
- Missing critical dependencies
- Incompatible version requirements
- Database migrations without rollback

**Data Loss Risks**
- Operations without validation
- Missing error handling in critical paths
- Race conditions in data operations

### 5. High-Level Findings (Summary Only)

Organize findings into categories, show counts and brief summary:

**Architecture & Structure**
- Overall architecture pattern (MVC, microservices, monolith, etc.)
- Code organization quality
- Module coupling and cohesion
- Circular dependencies
- Missing abstractions or over-engineering

**Tech Debt**
- Code duplication (significant patterns worth extracting)
- Outdated patterns or anti-patterns
- Commented-out code
- TODOs and FIXMEs
- Complex functions that need refactoring

**Testing**
- Test coverage (if measurable)
- Missing tests in critical paths
- Test quality and usefulness
- Integration vs unit test balance

**Documentation**
- README quality and completeness
- API documentation
- Setup instructions
- Architecture documentation
- Inline code documentation where needed

**Dependencies**
- Outdated packages (majors, minors)
- Unmaintained dependencies
- Bloated dependency tree
- Missing or loose version constraints

**Performance**
- Obvious bottlenecks
- Inefficient algorithms
- Database query issues
- Large bundle sizes (frontend)
- Memory leaks or resource handling

**Developer Experience**
- Build/dev setup complexity
- Error messages quality
- Debugging tools
- Local development workflow
- CI/CD pipeline speed

**Best Practices**
- Linting and formatting setup
- Error handling patterns
- Logging and observability
- Configuration management
- Environment handling

## Output Format

```markdown
## Tool Check

**Available:** trufflehog, npm
**Missing:** pip-audit (install with `pip install pip-audit`)

[If tools are missing: "Continue audit without these tools? [y/n]"]

---

## Security Scan Results

**trufflehog:** X secrets found
**npm audit:** Y vulnerabilities (Z critical, W high)

---

## Critical Issues 🚨
[Detailed list with file:line, what's wrong, why it matters, how to fix]
[Include findings from tools + manual review]

## Audit Summary

**Overall Health:** [Good / Fair / Needs Attention / Critical]

**Architecture:** [Brief assessment]
- [High-level finding 1]
- [High-level finding 2]

**Tech Debt:** [Count of major issues]
- [Summary of patterns]

**Testing:** [Coverage %, major gaps]
- [Brief assessment]

**Documentation:** [Status]
- [What's missing]

**Dependencies:** [X outdated, Y vulnerabilities]
- [High-level summary]

**Performance:** [Status]
- [Major concerns if any]

**Developer Experience:** [Assessment]
- [Key issues]

**Best Practices:** [Status]
- [Missing or inconsistent practices]

## Areas to Investigate

I can provide detailed analysis of:
1. [Specific area like "Test coverage gaps"]
2. [Specific area like "Dependency vulnerabilities"]
3. [Specific area like "Code duplication patterns"]
4. [etc.]

Ask me to investigate any area for detailed findings with file:line references and specific recommendations.
```

## Investigation Process

When asked to investigate a specific area:
- Search for relevant patterns
- Provide file:line references
- Give specific examples
- Suggest concrete fixes
- Prioritize by impact

## Tool Output Handling

**For npm/pnpm/yarn audit:**
- Parse JSON output for vulnerabilities
- Group by severity (critical, high, moderate, low)
- Show package name, vulnerability, and recommended fix
- Link to CVE/advisory when available

**For trufflehog:**
- Parse JSON for detected secrets
- Show file, line number, secret type
- Indicate if it's in git history or current files
- Suggest remediation (rotate keys, use env vars, etc.)

**For pip-audit/cargo audit:**
- Similar to npm audit - parse JSON for vulns
- Show package, version, fix version
- Include CVE references

**Error handling:**
- If a tool fails, note it and continue
- If output is unparseable, include raw relevant output
- Don't let tool failures block the audit

## Guidelines

- Be honest about the project state
- Focus on actionable findings, not theoretical issues
- Consider the project context (startup MVP vs enterprise system)
- Highlight what's done well, but keep it brief
- Group similar issues to avoid overwhelming output
- Prioritize findings by impact on security, stability, and maintainability
- Skip nitpicks that linters catch
- Tool findings take precedence - they're automated and objective
