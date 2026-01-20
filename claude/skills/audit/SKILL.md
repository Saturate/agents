---
name: audit
description: Performs comprehensive codebase audit checking architecture, tech debt, security, test coverage, documentation, dependencies, and maintainability. Use when auditing a project, assessing codebase health, or asked to audit/analyze the entire codebase.
allowed-tools: Read, Grep, Glob, Bash
---

# Codebase Audit

Audit the codebase like you're taking over a project - comprehensive but practical. Focus on what actually matters for maintenance, security, and developer experience.

## Audit Process

### 1. Understand the Project

- Check project structure (glob for key directories and files)
- Identify tech stack from package.json, requirements.txt, go.mod, etc.
- Look for documentation (README, CONTRIBUTING, docs/)
- Check for CI/CD, linting, testing setup

### 2. Critical Issues (Show Details Immediately)

These must be surfaced with full context:

**Security**
- Hardcoded secrets, credentials, API keys
- Known vulnerable dependencies
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

### 3. High-Level Findings (Summary Only)

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
## Critical Issues 🚨
[Detailed list with file:line, what's wrong, why it matters, how to fix]

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

## Guidelines

- Be honest about the project state
- Focus on actionable findings, not theoretical issues
- Consider the project context (startup MVP vs enterprise system)
- Highlight what's done well, but keep it brief
- Group similar issues to avoid overwhelming output
- Prioritize findings by impact on security, stability, and maintainability
- Skip nitpicks that linters catch
