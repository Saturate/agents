---
name: skill-router
description: Meta-skill that maps tasks to the right skill. Consult at the start of any non-trivial task to pick the right workflow skill, and before specific actions (installing deps, committing, opening PRs, reviewing) to pick the right action skill. Loaded automatically at session start by the skill-router plugin.
user-invocable: true
metadata:
  author: Saturate
  version: "1.0"
---

# Skill Router

This project ships workflow skills (*how to approach a type of work*) and action skills (*how to do a specific thing correctly*). Pick from the map below. Multiple can apply — chain them.

## Decision flowchart

```
Task arrives
  │
  ├── Vague idea, fuzzy goal ─────────────────→ idea-refine
  ├── About to plan non-trivial work ─────────→ pre-planning
  │
  ├── Implementing something ─────────────────→ incremental-implementation
  │     ├── UI / React / component work ──────→ frontend-ui-engineering
  │     ├── HTTP / API / contract design ─────→ api-design
  │     └── Writing tests first ──────────────→ tdd
  │
  ├── Something is broken ────────────────────→ debugging
  │     └── Looking for classes of bugs ──────→ hunting-bugs
  │
  ├── Performance concern ────────────────────→ performance-profiling
  ├── Security review / threat model ─────────→ security-deep-dive
  │
  ├── Reviewing code / PR ────────────────────→ pr-review  (also: code-review)
  ├── Simplifying code ───────────────────────→ code-simplification
  ├── Whole-codebase audit ───────────────────→ codebase-audit
  ├── Measuring code (LOC, complexity, dup) ──→ code-metrics
  │
  ├── Writing an ADR / architecture doc ──────→ documentation-adrs
  │
  ├── Pre-launch / deploy readiness ──────────→ launch-checklist
  │
  └── Action skills (narrow, tool-specific):
        ├── Adding a dependency ──────────────→ evaluating-dependencies
        │     ├── npm/pnpm/yarn/bun ─────────→ + node-package-management
        │     └── nuget / dotnet add ────────→ + nuget-package-management
        ├── Committing ──────────────────────→ commit
        ├── Opening a PR ────────────────────→ make-pr
        ├── Port conflict / starting dev ────→ managing-ports
        ├── Cloning an Azure DevOps project ─→ azure-init
        ├── Browser automation / scraping ───→ chrome-devtools
        └── Authoring a new skill ───────────→ validate-skill
```

## Rules

1. **Check the router before starting non-trivial work.** Vague prompts default to `idea-refine`. "Build X" without a spec defaults to `pre-planning` first.
2. **Workflow skills are chainable.** A typical feature: `pre-planning` → `incremental-implementation` → `tdd` → `pr-review` → `make-pr`.
3. **Action skills gate specific tool calls.** Installing a package? `evaluating-dependencies` first. Committing? `commit`. Opening a PR? `make-pr`. These are enforced by the `skill-router` plugin's PreToolUse advisor where it applies — but consult them regardless.
4. **Skills are not suggestions.** When a skill applies, follow its steps in order. Skipping the verification step of a workflow skill is the same as not running it.
5. **When multiple apply, run them in sequence.** Example: a UI feature → `pre-planning` → `frontend-ui-engineering` → `incremental-implementation` → `tdd` → `pr-review`.

## Core operating behaviors

These apply across every skill.

### 1. Surface assumptions before implementing

Before any non-trivial implementation, list the assumptions you're about to make. If the user doesn't correct them, proceed. Silent assumptions are the #1 source of wasted work.

### 2. Manage your own confusion

When the spec contradicts the code, or one source contradicts another: **stop**, name the conflict, present the tradeoff or ask. Do not guess.

### 3. Push back when warranted

Not a yes-machine. When an approach has a concrete downside (latency, security, maintenance), say so once, propose an alternative, then accept the decision if overridden.

### 4. Prefer boring, obvious solutions

Three similar lines beats a premature abstraction. Don't design for hypothetical future requirements. If the change is 100 lines and you wrote 500, you failed.

### 5. Scope discipline

Touch only what the task requires. Don't delete comments you don't understand. Don't refactor adjacent code "while you're there." Don't add features not in the spec.

### 6. Verify, don't assume

A task isn't done until there's evidence — passing tests, build output, runtime check. "Looks right" is not evidence.

## Quick reference

| Phase | Skill | One-line |
|---|---|---|
| Define | idea-refine | Sharpen vague ideas |
| Define | pre-planning | Gather context before planning |
| Plan | (use pre-planning output) | |
| Build | incremental-implementation | Vertical slices, verify each |
| Build | tdd | Red-green-refactor |
| Build | frontend-ui-engineering | UI with accessibility + performance |
| Build | api-design | Contract-first with security focus |
| Verify | debugging | Follow evidence, root cause |
| Verify | hunting-bugs | Pattern-based bug audit |
| Verify | performance-profiling | Measure → identify → fix → measure |
| Verify | security-deep-dive | Threat modeling, attack surface |
| Review | pr-review | Full PR review with checklists |
| Review | code-review | Code-level review |
| Review | code-simplification | Simplify safely |
| Review | codebase-audit | Whole-repo health |
| Review | code-metrics | LOC, complexity, dup signals |
| Review | documentation-adrs | Decision records |
| Ship | launch-checklist | Deploy readiness |
| Ship | commit | Commit message style |
| Ship | make-pr | Open PR with context-aware description |
| Action | evaluating-dependencies | Evaluate before install (polyglot) |
| Action | node-package-management | npm/pnpm/yarn/bun install mechanics |
| Action | nuget-package-management | .NET CPM + dotnet CLI |
| Action | managing-ports | Detect framework, start dev server |
| Action | azure-init | Clone all Azure DevOps project repos |
| Action | chrome-devtools | Browser automation via MCP |
| Action | validate-skill | Validate a new skill's quality |

## Failure modes

- Starting to code without checking the router (most common).
- Picking the first match instead of the best match.
- Following part of a skill and skipping verification.
- Inventing a skill that doesn't exist — only the skills listed above are real.
