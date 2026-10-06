---
name: spec
description: Write a structured specification before writing code. Produces SPEC.md outside the repo.
user-invocable: true
allowed-tools: Read Grep Glob Bash
metadata:
  author: Saturate
  version: "1.0"
---

# Spec

Write a structured spec before any code. The spec is the shared source of truth; code without one is guessing.

## When to skip

Single-file fixes, config changes, or tasks where requirements are unambiguous and self-contained. Note: `/build auto` requires a spec, so always run `/spec` before autonomous multi-task builds.

## Where specs live

Specs and plans are working notes, not project files. They live outside the repo so they never get committed:

```bash
repo=$(basename "$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")")
dir="$HOME/.claude/specs/$repo/<feature-slug>"   # SPEC.md and plan.md go here
```

`--git-common-dir` resolves to the main checkout, so every worktree of the repo shares the same specs. `<feature-slug>` is a short kebab-case name for the feature (e.g. `oauth-login`). Never write `SPEC.md`, `tasks/plan.md` or similar into the working tree.

`/build` records the feature branch in `$dir/BRANCH` (one line, the branch name) when it starts the first task.

### Archiving merged work

Whenever a skill lists `~/.claude/specs/$repo/` to pick a feature folder, first archive the finished ones. For each folder with a `BRANCH` file, check whether that branch's PR is merged:

- GitHub: `gh pr list --head <branch> --state merged --json number`
- Azure DevOps: `az repos pr list --source-branch <branch> --status completed`

Squash merges hide the branch from `git branch --merged`, so ask the platform instead of git. If the PR is merged, move the folder to `~/.claude/specs/$repo/done/<feature-slug>/` and say so. If the check fails (no CLI, offline, no PR yet), leave the folder alone. Folders under `done/` are never picked as the active feature.

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

Pick a feature slug, then create `$dir/SPEC.md` (see "Where specs live") covering these six areas:

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

Tell the user the full path of the saved spec.

## Rules

1. **The spec is a living document.** Update it when decisions or scope change. It stays out of git.
2. **Don't invent requirements.** If the spec doesn't cover something, stop and ask. Surface it in Open Questions.
3. **When docs conflict with existing code**, surface the conflict with options. Don't silently pick one.
4. **Use the spec in PRs.** Explain the relevant requirements in the PR description itself; the spec file is local, so a link to it means nothing to reviewers.
