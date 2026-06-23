---
description: Write a structured specification before writing code. Produces SPEC.md.
---

# Spec

Write a structured spec before any code. The spec is the shared source of truth; code without one is guessing.

## When to skip

Single-file fixes, config changes, or tasks where requirements are unambiguous and self-contained. Note: `/build auto` requires a spec, so always run `/spec` before autonomous multi-task builds.

## Process

### 1. Surface assumptions first

Before writing anything, list what you're assuming:

```text
ASSUMPTIONS:
1. This is a web application (not native mobile)
2. Authentication uses session-based cookies (not JWT)
3. The database is PostgreSQL (based on existing Prisma schema)
→ Correct me now or I'll proceed with these.
```

Silent assumptions are the #1 source of wasted work. Don't fill in ambiguous requirements.

### 2. Ask clarifying questions about

- The objective and target users
- Core features and acceptance criteria
- Tech stack preferences and constraints
- Known boundaries (always do, ask first, never do)

### 3. Detect the existing stack

Read the project's dependency files (`package.json`, `go.mod`, `Cargo.toml`, `.csproj`, `pyproject.toml`, etc.) to identify exact versions. State what you found:

```text
STACK DETECTED:
- React 19.1.0 (from package.json)
- Vite 6.2.0
- Tailwind CSS 4.0.3
```

### 4. Write the spec

Create `SPEC.md` at the project root covering these six areas:

```markdown
# Spec: [Project/Feature Name]

## Objective
What we're building and why. Who is the user. What success looks like.

## Tech Stack
Framework, language, key dependencies with versions.

## Commands
Full executable commands with flags:
- Build: `npm run build`
- Test: `npm test -- --coverage`
- Lint: `npm run lint --fix`
- Dev: `npm run dev`

## Project Structure
Where source code lives, where tests go, where docs belong.

## Code Style
One real code snippet showing the project's style. Naming conventions,
formatting rules. A snippet beats three paragraphs.

## Testing Strategy
Framework, test locations, coverage expectations, which test levels
for which concerns.

## Boundaries
- **Always:** Run tests before commits, follow naming conventions, validate inputs
- **Ask first:** Database schema changes, adding dependencies, changing CI config
- **Never:** Commit secrets, edit vendor directories, remove failing tests without approval

## Success Criteria
Specific, testable conditions. Not "make it fast" but
"dashboard LCP < 2.5s on 4G connection."

## Open Questions
Anything unresolved that needs human input.
```

### 5. Reframe vague requirements as success criteria

```text
REQUIREMENT: "Make the dashboard faster"

SUCCESS CRITERIA:
- Dashboard LCP < 2.5s on 4G connection
- Initial data load completes in < 500ms
- No layout shift during load (CLS < 0.1)
→ Are these the right targets?
```

### 6. Get human review

Present the spec for review. Do not proceed to planning or implementation until the human has explicitly approved it. "Sounds good" is not approval; ask "anything you'd change?"

Commit `SPEC.md` to version control once approved.

## Rules

1. **The spec is a living document.** Update when decisions or scope change. Commit updates alongside code.
2. **Don't invent requirements.** If the spec doesn't cover something, stop and ask. Surface it in Open Questions.
3. **When docs conflict with existing code**, surface the conflict with options. Don't silently pick one.
4. **Reference the spec in PRs.** Link back to the section each PR implements.
