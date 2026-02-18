# PR Description Guide

This guide helps you write effective PR descriptions with a casual but experienced engineer tone, explaining WHY not WHAT, avoiding robot speak.

## Table of Contents

1. [Core Principles](#core-principles)
2. [Structure](#structure)
3. [Title Guidelines](#title-guidelines)
4. [Description Guidelines](#description-guidelines)
5. [Analyzing Commits for Content](#analyzing-commits-for-content)
6. [Style Examples](#style-examples)
7. [What to Include](#what-to-include)
8. [Length Guidelines](#length-guidelines)
9. [Platform-Specific Notes](#platform-specific-notes)
10. [Quick Reference](#quick-reference)

---

## Core Principles

1. **Humble but experienced engineer tone** - You're explaining to a peer, not showing off
2. **Casual and conversational** - Like you're talking over coffee, not writing a report
3. **Explain WHY, not WHAT** - The code shows what changed; explain why you made those choices
4. **No robot speak or marketing buzzwords** - Avoid "leverage", "implement robust solution", "enhance functionality"
5. **Assume reader is technically competent** - Don't explain obvious things
6. **Focus on non-obvious implementation choices** - Decisions, trade-offs, constraints

## Structure

```markdown
[Title - under 70 characters]

[1-2 sentence intro: what changed and why]

[Optional: More context - decisions, trade-offs, constraints that aren't obvious]

## Changes
- Key change 1 (focus on why, not what)
- Key change 2
- Key change 3

## Testing
- [ ] Tested locally
- [ ] Added/updated tests
- [ ] Verified [relevant scenario]
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

### Testing section

Brief checklist of what was verified:

```markdown
## Testing
- [ ] Tested locally with dev DB
- [ ] Added tests for SSO flow
- [ ] Verified existing users can still log in
- [ ] Checked Redis fallback when cache is down
```

Don't list obvious things like "code compiles" or "tests pass".

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

## Style Examples

### Example 1: Feature addition

✅ **Good:**
```markdown
Add email verification for new signups

We were getting a lot of fake accounts, so now new users need to verify their email before they can post. Went with a simple token-in-URL approach rather than magic links since we don't have email rendering set up yet.

## Changes
- New verification flow after signup (before user can access dashboard)
- Tokens expire after 24 hours to limit DB bloat
- Existing users are grandfathered in as verified

## Testing
- [ ] Tested signup flow with real email
- [ ] Verified expired tokens are rejected
- [ ] Checked existing users can still log in
```

❌ **Bad:**
```markdown
Implement comprehensive email verification system

This PR implements a robust email verification system to enhance security and prevent unauthorized access. The solution leverages token-based authentication and follows industry best practices.

## Changes
- Implemented email verification functionality
- Created verification token generation system
- Added email sending capabilities
- Updated user model to include verification status
- Enhanced security measures
- Improved user experience
- Added comprehensive test coverage
- Updated documentation
```

### Example 2: Bug fix

✅ **Good:**
```markdown
Fix race condition in payment processing

Orders were sometimes charging twice when users double-clicked the checkout button. Added a processing state and disabled the button, plus idempotency keys on the Stripe side just to be safe.

## Testing
- [ ] Verified rapid clicks don't cause double charge
- [ ] Tested with flaky network (slow responses)
- [ ] Checked Stripe dashboard shows single charge
```

❌ **Bad:**
```markdown
Fix payment processing issue

This PR resolves a critical issue in the payment processing system where duplicate charges could occur under certain race conditions.

## Changes
- Fixed race condition
- Added button state management
- Implemented idempotency
- Improved error handling
```

### Example 3: Refactoring

✅ **Good:**
```markdown
Break up god-class OrderService

OrderService was doing too much (validation, pricing, inventory, shipping). Split it into focused services. Left the old class as a facade for now since there are a lot of call sites to update.

## Changes
- Pulled pricing logic into PricingService (needed this for the quote feature anyway)
- Moved inventory checks to InventoryService (shared with warehouse dashboard)
- Created ShippingService for carrier logic
- OrderService now just orchestrates the others

## Testing
- [ ] All existing tests still pass (using facade)
- [ ] Added tests for new services in isolation
```

❌ **Bad:**
```markdown
Refactor OrderService for improved architecture

This PR refactors the OrderService class to improve code organization and maintainability through separation of concerns.

## Changes
- Refactored OrderService
- Created new service classes
- Improved code organization
- Enhanced testability
- Better separation of concerns
```

## What to Include

### ✅ Include

- **Non-obvious decisions:** Why you chose approach A over B
- **Trade-offs:** What you gained and what you gave up
- **Constraints:** Time, compatibility, dependencies
- **Future considerations:** "We'll need this when..." or "Left old code because..."
- **Context for reviewers:** Things that might be surprising or need explanation

### ❌ Skip

- **What the code does:** Visible in the diff
- **Implementation details:** Unless they're surprising or clever
- **History/conversation:** "We discussed this", "As mentioned before"
- **Obvious observations:** "Added tests", "Fixed bug"
- **Platitudes:** "Improves maintainability", "Follows best practices"

## Length Guidelines

### Minimum (simple PRs)
2-3 sentences explaining what and why:
```markdown
Fix broken logout button on mobile

The button was hidden behind the nav on small screens. Adjusted z-index and added a test for the viewport.
```

### Typical (most PRs)
1-2 paragraphs + bullet points:
```markdown
Add rate limiting to API endpoints

We were getting hammered by a misconfigured client last week. Added simple rate limiting (100 req/min per IP) using Redis. Went with fixed window instead of sliding window for simplicity - if abuse becomes more sophisticated we can upgrade later.

## Changes
- Rate limit middleware using Redis (falls back to in-memory if Redis is down)
- 429 responses with Retry-After header
- Exempted health check endpoint

## Testing
- [ ] Verified limits trigger after 100 requests
- [ ] Tested Redis failover to in-memory
- [ ] Health check still works
```

### Maximum (complex PRs)
3-4 paragraphs + details. If you need more than this, consider if the PR should be split:
```markdown
Migrate authentication from sessions to JWT

We need to support mobile apps, which don't handle cookies well. Switched to JWT with refresh tokens. Kept session support for now with a feature flag since we can't migrate all web users immediately.

The refresh token rotation is a bit complex - each use generates a new refresh token and invalidates the old one. This limits the window for token theft. Tokens are stored in Redis with a 7-day TTL, and we purge them on logout.

Considered using httpOnly cookies for the JWT, but mobile webviews are inconsistent with cookie handling. Went with localStorage for web and secure storage for mobile. Yeah, XSS is a risk, but we have CSP and this unblocks the mobile launch.

## Changes
- JWT auth with RS256 (public/private key pair)
- Refresh token rotation (prevents token reuse)
- Feature flag to switch between session and JWT
- Migration script to generate tokens for active sessions

## Testing
- [ ] Web login flow with JWT
- [ ] Mobile app login (tested on iOS/Android)
- [ ] Token refresh before expiry
- [ ] Logout invalidates tokens
- [ ] Old session auth still works (feature flag)
```

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
