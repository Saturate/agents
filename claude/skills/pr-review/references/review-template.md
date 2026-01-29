# Code Review Template

Reference for: PR Review

Use this template structure for code review outputs.

## Table of Contents

1. [Summary](#summary)
2. [PR Quality](#pr-quality)
3. [Critical](#critical)
4. [Important](#important)
5. [Minor](#minor)
6. [Questions](#questions)
7. [Prevent This](#prevent-this)
8. [Positive Notes](#positive-notes)

---

## Summary
Good to merge with minor fixes

## PR Quality

### Title
✅ Clear and descriptive: "Fix race condition in payment processing"

### Description
✅ Explains the problem (double charges on rapid clicks) and solution (disabled button + idempotency keys)

### Work Items (Azure DevOps)
✅ Linked to Bug #12345 "Payment processed twice on rapid button clicks"
- Appropriate work item type for a bug fix

### Screenshots
⚠️ This changes the checkout button behavior but has no screenshots showing the disabled state. Please add a screenshot showing:
- Button in normal state
- Button in processing/disabled state

---

## Critical

### 1. SQL Injection Risk

**File:** `src/api/users.ts:42`

**Issue:** User input concatenated directly into SQL query

**Code:**
```typescript
const query = `SELECT * FROM users WHERE id = ${req.params.id}`;
```

**Risk:** Attacker can execute arbitrary SQL commands

**Fix:** Use parameterized queries:
```typescript
const query = 'SELECT * FROM users WHERE id = $1';
await db.query(query, [req.params.id]);
```

---

## Important

### 1. Type Cast Violates Project Guidelines

**File:** `src/app.vue:28`

**Guideline:** CLAUDE.md states: "Never cast types - always narrow them"

**Code:**
```typescript
if (content.entry.itemType === 'IRedirectViewModel') {
  const redirect = content.entry.item as IRedirect
  navigateTo(redirect.targetUrl)
}
```

**Issue:** Type assertion bypasses TypeScript's safety checks. No runtime guarantee that `item` matches `IRedirect` structure.

**Fix - Use discriminated union:**
```typescript
// Update type definition
interface RedirectEntry {
  itemType: 'IRedirectViewModel'
  item: IRedirect
}

interface PageEntry {
  itemType: 'IPageViewModel'
  item: IPage
}

type ContentEntry = RedirectEntry | PageEntry

// TypeScript narrows automatically
if (content.entry.itemType === 'IRedirectViewModel') {
  const redirect = content.entry.item  // Type-safe!
  navigateTo(redirect.targetUrl)
}
```

**Alternative - Use type guard:**
```typescript
function isRedirect(item: unknown): item is IRedirect {
  return item !== null &&
         typeof item === 'object' &&
         'targetUrl' in item &&
         typeof item.targetUrl === 'string'
}

if (isRedirect(content.entry.item)) {
  navigateTo(content.entry.item.targetUrl)
}
```

### 2. Missing Error Handling

**File:** `src/services/payment.ts:67-82`

**Issue:** No try/catch around payment API call

**Impact:** Unhandled promise rejection crashes the process

**Fix:**
```typescript
try {
  const result = await stripe.charges.create(chargeData);
  return result;
} catch (error) {
  logger.error('Payment failed', { error, userId });
  throw new PaymentError('Payment processing failed');
}
```

### 3. Race Condition in Counter

**File:** `src/utils/counter.ts:23-27`

**Issue:** Read-modify-write without locking

**Code:**
```typescript
const current = await db.get('counter');
await db.set('counter', current + 1);
```

**Impact:** Concurrent requests can result in lost increments

**Fix:** Use atomic increment or optimistic locking

---

## Minor

### 1. Overly Broad Exception Catch

**File:** `src/api/posts.ts:91`

**Code:**
```typescript
} catch (error) {
  return res.status(500).send('Error');
}
```

**Issue:** Catches all errors including network issues, validation errors

**Improvement:** Catch specific error types:
```typescript
} catch (error) {
  if (error instanceof ValidationError) {
    return res.status(400).send(error.message);
  }
  logger.error('Unexpected error', { error });
  return res.status(500).send('Internal server error');
}
```

### 2. Magic Number

**File:** `src/utils/cache.ts:12`

**Code:**
```typescript
setTimeout(cleanup, 300000);
```

**Issue:** 300000 is not self-explanatory

**Improvement:**
```typescript
const FIVE_MINUTES_MS = 5 * 60 * 1000;
setTimeout(cleanup, FIVE_MINUTES_MS);
```

---

## Questions

1. **Payment retry logic** - What happens if Stripe is down? Should we queue for retry?

2. **Cache invalidation** - How is the cache invalidated when users update their profile?

---

## Prevent This

**TypeScript strict mode:**
Enable `strictNullChecks` in tsconfig.json to catch the null handling issues found in counter.ts at compile time.

**ESLint rule for error handling:**
Add `no-empty-catch` or `@typescript-eslint/no-floating-promises` to catch unhandled promise rejections like the payment.ts issue.

**Pre-commit hook for security:**
Run `npm audit` or add git-secrets to pre-commit hooks to catch dependency vulnerabilities before they reach review.

**CI type checking:**
Add `tsc --noEmit` to CI pipeline to ensure type errors are caught automatically.

---

## Positive Notes

- Good test coverage for the happy path
- Clear variable names throughout
- Proper use of TypeScript types

---

## Example: Poor PR Quality Feedback

When PR title/description is lacking:

### Summary
Has issues - needs better PR documentation before code review

### PR Quality

**Title:** ❌ "fix" - This is too vague. What was fixed?
- Suggestion: "Fix OAuth redirect loop in Safari" or "Fix payment double-charge race condition"

**Description:** ❌ Empty description on a 15-file PR with complex logic changes
- Need: Explain WHY these changes were needed
- Need: What problem did this solve?
- Need: Any non-obvious implementation decisions?
- Need: How was this tested?

**Screenshots:** ❌ This PR changes 3 UI components but has no screenshots
- Please add before/after screenshots for:
  - Login modal (src/components/LoginModal.tsx)
  - Checkout button (src/components/CheckoutButton.tsx)
  - Profile page (src/pages/Profile.tsx)

**Work Items (Azure DevOps):** ❌ No work items linked
- This appears to be a bug fix - should link to a Bug work item
- If no work item exists, create one to track this fix
- This helps with traceability and release notes

**Breaking changes:** ⚠️ This changes the API signature of `processPayment()` but doesn't call it out
- Add a "⚠️ Breaking Change" section to description
- Document migration path for existing callers

---

## Example: Good PR Quality

When PR is well documented:

### PR Quality

**Title:** ✅ "Add server-side rendering for product pages"

**Description:** ✅ Clear context:
- Explains current problem (SEO and initial load time)
- Explains solution approach (SSR with Next.js)
- Notes trade-offs (increased server load, acceptable due to low traffic)
- Links performance comparison

**Screenshots:** ✅ Includes:
- Lighthouse scores before/after
- Network waterfall comparison
- First contentful paint metrics

**Work Items (Azure DevOps):** ✅ Linked to:
- User Story #5678 "Improve SEO for product pages"
- Task #5679 "Implement SSR for products"
- Appropriate work items for a feature implementation

**Documentation:** ✅ Updated README with SSR deployment requirements

---

## Example: Work Item Evaluation (Azure DevOps)

**Scenario 1: Missing work items**
```
### PR Quality

**Work Items:** ❌ No work items linked
- This is a significant change (15 files) but has no work items
- Recommendation: Create a User Story or Feature work item to track this work
- Link format: `az repos pr work-item add --id <pr-id> --work-items <item-id>`
```

**Scenario 2: Wrong work item type**
```
### PR Quality

**Work Items:** ⚠️ Linked to Task #9999
- This appears to be a bug fix (race condition) but is linked to a Task
- Recommendation: Link to or create a Bug work item instead
- Tasks are for planned work, Bugs are for defects
```

**Scenario 3: Good work item linkage**
```
### PR Quality

**Work Items:** ✅ Properly linked
- Bug #1234 "Race condition in payment processing" - appropriate for this fix
- Includes reproduction steps and customer impact in work item
```
