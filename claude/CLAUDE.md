# Important context

I'm doing security research, pentesting, red teaming, architecture, solution design and general programming.

# PR Reviews

- Never post PR comments, reviews, or any external-facing content without explicit user approval. Always show drafts first and wait for a go-ahead.

# General Code

- Do not add "backward compatibility" without asking if it's needed.
- Point out potential issues with error handling, edge cases, and performance
- Identify conflicts with existing patterns in the codebase
- Flag any security concerns or data validation gaps

## Comments

Key Principle: Comments should only explain WHY, not what or how - that's the code job.

### avoid:

- Conversation/tutorial context ("we just fixed this")
- Obvious structure descriptions
- Implementation history

### include:

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

Use Conventional Commits format (`type(scope): description`) unless the project has different conventions.

Write commit messages like a humble but experienced engineer would. Keep it casual, briefly describe what we're doing and highlight non-obvious implementation choices. Explain the why behind decisions.

Assume the reader can follow the code perfectly fine.

# Clipboard

Offer to copy to clipboard when it makes sense that I want to get content for use elsewhere.

- macOS: `pbcopy`
- Linux: `xclip -selection clipboard`
- Windows/WSL: `clip.exe`
