# General Code

- Do not add "backward compatibility" without asking if it's needed.
- Before adding new dependencies, evaluate their need, security and maintenance status along with bundle impact if any.
- Point out potential issues with error handling, edge cases, and performance
- Identify conflicts with existing patterns in the codebase
- Flag any security concerns or data validation gaps

## Comments

Key Principle: Comments should only explain WHY, not what or how - that's the code job.

### What to avoid:

- Conversation/tutorial context ("we just fixed this")
- Obvious structure descriptions
- Implementation history

### What to include:

- Business logic decisions
- Browser quirks and workarounds
- Non-obvious constraints
- Reasoning for magic numbers

# TypeScript

- Always prefer using TS in frontend repos.
- Use strict style
- Never cast types - always narrow them
- For API's prefer getting types from swagger or similar, no any or unknowns.

# Git Commits

Only consider the diff for the current changes, not the session history or prompt conversation.

Use Conventional Commits format (`type(scope): description`) unless the project has different conventions. Check existing commits to match the style.

Write commit messages like a humble but experienced engineer would. Keep it casual, briefly describe what we're doing and highlight non-obvious implementation choices. Explain the why behind decisions.

No robot speak, marketing buzzwords, or listicles. Assume the reader can follow the code perfectly fine.

# Exports and Clipboard

When I ask for content to "export", "handoff", "save for later", or similar - automatically copy it to clipboard using the appropriate tool:
- macOS: `pbcopy`
- Linux: `xclip -selection clipboard` (if available)
- Windows/WSL: `clip.exe`

Useful for: prompt handoffs, summaries, formatted outputs, git info, file paths, etc.
