---
description: Break work into small verifiable tasks with acceptance criteria and dependency ordering. Produces tasks/plan.md.
---

# Plan

Decompose work into small, verifiable tasks. Each task should be completable in a single focused session with explicit acceptance criteria.

## Prerequisites

Read the spec (`SPEC.md`, `docs/SPEC.md`, or a file under `spec/`) and the relevant codebase sections before planning. If no spec exists, stop and ask the user to run `/spec` first.

## Process

### 1. Enter read-only mode

- Read the spec and relevant codebase sections
- Identify existing patterns and conventions
- Map dependencies between components
- Note risks and unknowns

**Do NOT write code during planning.** The output is a plan document, not implementation.

### 2. Identify the dependency graph

Map what depends on what:

```
Database schema
    ├── API models/types
    │       ├── API endpoints
    │       │       └── Frontend API client
    │       │               └── UI components
    │       └── Validation logic
    └── Seed data / migrations
```

Implementation order follows the dependency graph bottom-up.

### 3. Slice vertically

Build one complete feature path at a time, not horizontal layers:

**Bad (horizontal):**
- Task 1: Build entire database schema
- Task 2: Build all API endpoints
- Task 3: Build all UI components

**Good (vertical):**
- Task 1: User can create an account (schema + API + UI for registration)
- Task 2: User can log in (auth schema + API + UI for login)
- Task 3: User can create a task (task schema + API + UI for creation)

Each vertical slice delivers working, testable functionality.

### 4. Write tasks

Each task follows this structure:

```markdown
## Task [N]: [Short descriptive title]

**Description:** One paragraph explaining what this task accomplishes.

**Acceptance criteria:**
- [ ] [Specific, testable condition]
- [ ] [Specific, testable condition]

**Verification:**
- [ ] Tests pass: `npm test -- --grep "feature-name"`
- [ ] Build succeeds: `npm run build`
- [ ] Manual check: [description of what to verify]

**Dependencies:** [Task numbers this depends on, or "None"]

**Files likely touched:**
- `src/path/to/file.ts`
- `tests/path/to/test.ts`

**Estimated scope:** [Small: 1-2 files | Medium: 3-5 files | Large: 5+ files]
```

### 5. Order and checkpoint

- Dependencies satisfied (build foundation first)
- Each task leaves the system in a working state
- Verification checkpoints after every 2-3 tasks
- High-risk tasks early (fail fast)

Add explicit checkpoints:

```markdown
## Checkpoint: After Tasks 1-3
- [ ] All tests pass
- [ ] Application builds without errors
- [ ] Core user flow works end-to-end
- [ ] Review with human before proceeding
```

### 6. Save and present

Save to `tasks/plan.md`. Present the plan for human review.

Do not begin implementation until the human has explicitly approved the plan.

## Task sizing

| Size | Files | Example |
|------|-------|---------|
| **S** | 1-2 | Add a new API endpoint |
| **M** | 3-5 | User registration flow |
| **L** | 5-8 | Search with filtering and pagination |
| **XL** | 8+ | **Too large; break it down further** |

If a task is L or larger, split it. An agent performs best on S and M tasks.

**When to split further:**
- Cannot describe acceptance criteria in 3 or fewer bullet points
- Touches two or more independent subsystems
- You find yourself writing "and" in the task title (a sign it's two tasks)

## Rules

1. **No code during planning.** The plan is the deliverable, not implementation.
2. **Every task has acceptance criteria and verification.** A task without these is a wish, not a plan.
3. **Vertical slices only.** Horizontal layers (all DB, then all API, then all UI) create integration risk.
4. **The human approves the plan before work begins.** Present it, get an explicit yes.
