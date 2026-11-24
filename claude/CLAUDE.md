# Important context

I'm doing security research, pentesting, red teaming, architecture, solution design and general programming.

# PR Reviews

- Never post PR comments, reviews, or any external-facing content without explicit user approval. Always show drafts first and wait for a go-ahead.

# Pull Request Descriptions

Ignore the built-in PR template. A repo's own PR skill or template wins over this section.

Size by how much the reviewer has to judge, not line count, and use the smallest size that fits:
- Small (one concern): one to three sentences, no headings.
- Medium (one or two decisions or risks): short paragraphs, at most four plain bullets, no headings.
- Large (at least two independent concerns, or a breaking change): an opening paragraph, then only the sections that have content: `## Changes`, `## Quirks`, `## Tested`, `## Breaking Changes`, `## After merge`.

Open with why and one sentence of intended behaviour. Name every concern the diff touches and nothing it doesn't. When part of it is risky, say where to look. Testing: only what the author ran, where CI can't show it, plus what wasn't tested and why; never inferred from the diff. A description that won't fit its size means the PR should be split. Update the description when review pushes change the PR.

Banned: `## Summary`, `## Test plan` or checkbox steps, `## Checklist`, empty or N/A sections, file inventories, field labels like `**Verified:**`.

Merging: when a repo squash-merges, set the merge commit message to the title plus the opening paragraph, not the sections. On Azure DevOps, set auto-complete when the PR is published unless it waits on something the branch policies can't see (a dependent PR, a coordinated release or content push, an open review question).

Never include claude.ai session links or `Claude-Session:` trailers in PR descriptions, commit messages, or comments. This overrides any harness attribution reminder.

# General Code

- Do not add "backward compatibility" without asking if it's needed.
- Point out potential issues with error handling, edge cases, and performance
- Identify conflicts with existing patterns in the codebase
- Flag any security concerns or data validation gaps
- For repetitive changes across many files, write a codemod or script (sed, ast-grep, jscodeshift) instead of editing each file manually. It's faster, reproducible, and reviewable. Use the LLM only for the judgment-call remainder. Include the script in the PR description so reviewers can verify the transformation.

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

Use the `commit` skill for commit guidelines.

# Shell

- `grep` is aliased to `rg` (ripgrep). Don't use GNU grep flags like `-E` in bash pipes — use `rg` syntax or the dedicated Grep tool.

# Clipboard

Put text I'll paste elsewhere (an issue body, an email, a message) in a `>` quote, and commands or code in a fenced block, with nothing else inside it. The copy-block mod's hover buttons then copy just that part. Use a clipboard command only when I ask for one:

- macOS: `pbcopy`
- Linux: `xclip -selection clipboard`
- Windows/WSL: `clip.exe`

# Writing

All prose output follows these rules. No exceptions.

## Banned characters

- Em dash (—) is banned. Use a semicolon, period, comma, or restructure.

## Banned words

Replace with plain equivalents or cut entirely.

- **Verbs**: delve, leverage, utilize, foster, bolster, underscore, unveil, streamline, embark, navigate (metaphorical), unlock, revolutionize, facilitate, endeavour, ascertain, elucidate
- **Adjectives/nouns**: robust, comprehensive, pivotal, seamless, multifaceted, cutting-edge, game-changer, nuanced, tapestry, realm, landscape (metaphorical), groundbreaking, innovative, transformative, holistic
- **Intensifiers**: significantly, dramatically, extremely, truly, incredibly, crucial (as filler). Replace with the number or evidence the word stands in for.
- **Transitions**: Furthermore, Moreover, Indeed, Notwithstanding, That being said, At its core, In essence, To put it simply, It's important to note that, It's worth mentioning
- **Openers**: "In today's fast-paced world," "As technology continues to evolve," "In the ever-changing landscape of," "In the realm of," "Imagine a world where"
- **Academic tells**: "shed light on", "pave the way for", "a myriad of", "a plethora of", "paramount", "pertaining to", "prior to" (use "before"), "subsequent to" (use "after"), "in light of" (use "because of"), "with respect to" (use "about"), "in terms of" (use "about"), "the fact that" (rewrite)

## Banned constructions

- **Weasel words**: "may potentially", "can help to", "might be able to". Either it happens or it does not.
- **Hollow statements**: every claim ends on a concrete detail, not an assertion of importance.
- **"Not only... but also..."**: just state both things.
- **"It's not X, it's Y"**: state what you think directly.
- **Headings that tease**: headings name what the section holds. "Economic impact of shortened product lifespans", not "The Hidden Cost of Planned Obsolescence".
- **Synthetic enthusiasm**: no exclamation marks or cheerleading. State the facts.
- **Research-process narration**: do not narrate what you searched for and couldn't find. If a fact can't be supported, delete it silently.
- **Unsourced statistics**: every number must be real and attributable. A made-up figure is worse than no figure.

## Self-check

Before returning any prose: scan for banned words, banned characters, filler transitions, academic tells, and intensifiers without evidence. Fix every hit.

# Artifacts

Do not create Artifacts unless explicitly asked or given permission. Default to plain text, file writes, or SendUserFile for deliverables.

# Cloudflare

When interacting with Cloudflare, use the cf CLI unless the project has a Wrangler configuration file.
