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
