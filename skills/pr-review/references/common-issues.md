# Common Code Review Issues

Reference for: PR Review

Quick reference for frequently found issues in code reviews.

## Table of Contents

1. [Type Safety Violations](#type-safety-violations)
2. [Security](#security)
3. [Error Handling](#error-handling)
4. [Performance](#performance)
5. [Logic Bugs](#logic-bugs)
6. [Code Quality](#code-quality)
7. [TypeScript Issues](#typescript-issues)
8. [Testing](#testing)
9. [Accessibility](#accessibility)
10. [Database Migrations](#database-migrations)
11. [Quick Reference](#quick-reference)

---

## Type Safety Violations

**Critical:** Type casts and assertions bypass TypeScript's safety checks. Most projects forbid these - check CLAUDE.md.

### Type Casting Instead of Narrowing

❌ **Bad - Type Assertion:**
```typescript
interface IRedirect {
  targetUrl: string
  statusCode: number
}

if (content.entry.itemType === 'IRedirectViewModel') {
  const redirect = content.entry.item as IRedirect  // Bypasses type checking!
}
```

**Problems:**
- No runtime guarantee that `item` matches `IRedirect` structure
- Changes to `IRedirect` won't be caught if `item` doesn't match
- Violates most project guidelines (check CLAUDE.md)

✅ **Good - Discriminated Union:**
```typescript
interface RedirectEntry {
  itemType: 'IRedirectViewModel'
  item: IRedirect
}

interface PageEntry {
  itemType: 'IPageViewModel'
  item: IPage
}

type ContentEntry = RedirectEntry | PageEntry

// TypeScript narrows automatically based on discriminant
if (content.entry.itemType === 'IRedirectViewModel') {
  const redirect = content.entry.item  // TypeScript knows this is IRedirect
  console.log(redirect.targetUrl)  // Type-safe!
}
```

✅ **Good - Type Guard:**
```typescript
function isRedirect(item: unknown): item is IRedirect {
  return (
    item !== null &&
    typeof item === 'object' &&
    'targetUrl' in item &&
    typeof item.targetUrl === 'string' &&
    'statusCode' in item &&
    typeof item.statusCode === 'number'
  )
}

if (isRedirect(content.entry.item)) {
  const redirect = content.entry.item  // Safely narrowed with runtime check
  console.log(redirect.targetUrl)  // Type-safe!
}
```

✅ **Good - Validation Library:**
```typescript
import { z } from 'zod'

const RedirectSchema = z.object({
  targetUrl: z.string(),
  statusCode: z.number()
})

// Parse validates structure at runtime
const redirect = RedirectSchema.parse(content.entry.item)
console.log(redirect.targetUrl)  // Type-safe and validated!
```

### Non-Null Assertion

❌ **Bad:**
```typescript
const user = users.find(u => u.id === userId)!  // What if not found?
console.log(user.name)  // Runtime error if user is undefined
```

✅ **Good:**
```typescript
const user = users.find(u => u.id === userId)
if (!user) {
  throw new Error(`User ${userId} not found`)
}
console.log(user.name)  // Safe - TypeScript knows user is defined
```

### Double Assertion

❌ **Bad - Double Assertion:**
```typescript
const value = input as unknown as SomeType  // Extremely dangerous!
```

**Never do this.** If you need this, your type definitions are wrong.

### When Type Assertions Are Acceptable

Very rarely, in specific cases:
- Reading from `localStorage` where you control the format
- Working with poorly-typed third-party libraries
- **Always validate at runtime when using assertions**

```typescript
// If you must use `as`, validate immediately after
const stored = localStorage.getItem('user') as string | null
if (!stored) throw new Error('No user in storage')

const user = JSON.parse(stored)
// Validate the parsed object matches expected structure
if (!user.id || typeof user.name !== 'string') {
  throw new Error('Invalid user data in storage')
}
```

---

## Security

### Hardcoded Secrets
```javascript
// ❌ Bad
const API_KEY = "sk_live_abc123";

// ✓ Good
const API_KEY = process.env.API_KEY;
```

### SQL Injection
```javascript
// ❌ Bad
const query = `SELECT * FROM users WHERE id = ${userId}`;

// ✓ Good
const query = 'SELECT * FROM users WHERE id = $1';
db.query(query, [userId]);
```

### XSS Vulnerabilities
```jsx
// ❌ Bad
<div dangerouslySetInnerHTML={{__html: userInput}} />

// ✓ Good
<div>{DOMPurify.sanitize(userInput)}</div>
```

### Weak Password Requirements
```javascript
// ❌ Bad
if (password.length < 6) return false;

// ✓ Good
if (password.length < 12 || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
  return false;
}
```

## Error Handling

### Swallowed Errors
```javascript
// ❌ Bad
try {
  await riskyOperation();
} catch (e) {
  // Silent failure
}

// ✓ Good
try {
  await riskyOperation();
} catch (error) {
  logger.error('Operation failed', { error, context });
  throw new OperationError('Failed to complete operation');
}
```

### Missing Null Checks
```javascript
// ❌ Bad
const name = user.profile.name.toUpperCase();

// ✓ Good
const name = user?.profile?.name?.toUpperCase() ?? 'Unknown';
```

### Unhandled Promise Rejections
```javascript
// ❌ Bad
async function loadData() {
  const data = await fetchData(); // Can reject
  return data;
}

// ✓ Good
async function loadData() {
  try {
    const data = await fetchData();
    return data;
  } catch (error) {
    logger.error('Failed to load data', { error });
    return null;
  }
}
```

## Performance

### N+1 Queries
```javascript
// ❌ Bad
for (const post of posts) {
  post.author = await User.findById(post.authorId);
}

// ✓ Good
const authorIds = posts.map(p => p.authorId);
const authors = await User.findByIds(authorIds);
const authorMap = new Map(authors.map(a => [a.id, a]));
posts.forEach(post => {
  post.author = authorMap.get(post.authorId);
});
```

### Missing Indexes
```javascript
// ❌ Bad: Querying without index
User.find({ email: 'user@example.com' }); // No index on email

// ✓ Good: Add index
// In migration:
await db.createIndex('users', { email: 1 });
```

### Unnecessary Re-renders
```jsx
// ❌ Bad
function Component({ data }) {
  const processed = expensiveOperation(data); // Runs every render
  return <div>{processed}</div>;
}

// ✓ Good
function Component({ data }) {
  const processed = useMemo(() => expensiveOperation(data), [data]);
  return <div>{processed}</div>;
}
```

## Logic Bugs

### Off-by-One Errors
```javascript
// ❌ Bad
for (let i = 0; i <= array.length; i++) {  // <= is wrong
  console.log(array[i]);
}

// ✓ Good
for (let i = 0; i < array.length; i++) {
  console.log(array[i]);
}
```

### Race Conditions
```javascript
// ❌ Bad
let counter = 0;
async function increment() {
  const current = counter;
  await someAsyncOperation();
  counter = current + 1; // Race condition
}

// ✓ Good
let counter = 0;
const lock = new AsyncLock();
async function increment() {
  await lock.acquire('counter', async () => {
    counter++;
  });
}
```

### Type Coercion Bugs
```javascript
// ❌ Bad
if (value == null) { // Matches both null and undefined

// ✓ Good
if (value === null) { // Only null
if (value === undefined) { // Only undefined
if (value == null) { // Explicitly want both (rare)
```

## Code Quality

### Magic Numbers
```javascript
// ❌ Bad
setTimeout(cleanup, 86400000);

// ✓ Good
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
setTimeout(cleanup, ONE_DAY_MS);
```

### Deeply Nested Code
```javascript
// ❌ Bad
if (user) {
  if (user.isActive) {
    if (user.hasPermission) {
      if (!user.isBanned) {
        doSomething();
      }
    }
  }
}

// ✓ Good
if (!user) return;
if (!user.isActive) return;
if (!user.hasPermission) return;
if (user.isBanned) return;
doSomething();
```

### Poor Variable Names
```javascript
// ❌ Bad
const d = new Date();
const x = users.filter(u => u.a);

// ✓ Good
const currentDate = new Date();
const activeUsers = users.filter(user => user.isActive);
```

### Commented-Out Code
```javascript
// ❌ Bad
function process(data) {
  // const old = transform(data);
  // return old.map(x => x.value);
  return data.map(item => item.value);
}

// ✓ Good
function process(data) {
  return data.map(item => item.value);
}
// If you need history, use git
```

## TypeScript Issues

### Explicit Any
```typescript
// ❌ Bad
function process(data: any) {
  return data.value;
}

// ✓ Good
function process(data: { value: string }) {
  return data.value;
}
```

### Type Casting
```typescript
// ❌ Bad
const value = (data as User).name;

// ✓ Good: Type narrowing
if ('name' in data) {
  const value = data.name;
}
```

### Missing Return Type
```typescript
// ❌ Bad
async function fetchUser(id: string) {
  return await db.users.findById(id);
}

// ✓ Good
async function fetchUser(id: string): Promise<User | null> {
  return await db.users.findById(id);
}
```

## Testing

### Testing Implementation Details
```javascript
// ❌ Bad
expect(component.state.count).toBe(1);

// ✓ Good
expect(screen.getByText('Count: 1')).toBeInTheDocument();
```

### Brittle Selectors
```javascript
// ❌ Bad
await page.click('.MuiButton-root:nth-child(2)');

// ✓ Good
await page.click('[data-testid="submit-button"]');
```

### Missing Edge Cases
```javascript
// ❌ Bad: Only tests happy path
test('divides numbers', () => {
  expect(divide(10, 2)).toBe(5);
});

// ✓ Good: Tests edge cases
test('divides numbers', () => {
  expect(divide(10, 2)).toBe(5);
  expect(divide(10, 3)).toBeCloseTo(3.33);
  expect(() => divide(10, 0)).toThrow('Division by zero');
  expect(divide(0, 10)).toBe(0);
});
```

## Accessibility

### Missing Alt Text
```html
<!-- ❌ Bad -->
<img src="chart.png" />

<!-- ✓ Good - descriptive -->
<img src="chart.png" alt="Monthly revenue growth from $10k to $45k over 6 months" />

<!-- ✓ Good - decorative, hidden from screen readers -->
<img src="divider.png" alt="" />
```

### Keyboard Inaccessible Interactive Elements
```html
<!-- ❌ Bad - div click handler is not keyboard accessible -->
<div onClick={handleDelete}>Delete</div>

<!-- ✓ Good -->
<button onClick={handleDelete}>Delete</button>

<!-- ✓ Good - if you must use a non-semantic element -->
<div role="button" tabIndex={0} onClick={handleDelete} onKeyDown={e => e.key === 'Enter' && handleDelete()}>
  Delete
</div>
```

### Missing Form Labels
```html
<!-- ❌ Bad -->
<input type="email" placeholder="Email address" />

<!-- ✓ Good - explicit label -->
<label htmlFor="email">Email address</label>
<input id="email" type="email" />

<!-- ✓ Good - aria-label when visible label isn't possible -->
<input type="search" aria-label="Search products" />
```

### Focus Not Managed After Dynamic Changes
```typescript
// ❌ Bad - modal opens but focus stays behind it
function openModal() {
  setModalOpen(true)
}

// ✓ Good - move focus into modal when it opens
function openModal() {
  setModalOpen(true)
  requestAnimationFrame(() => {
    modalRef.current?.focus()
  })
}
```

### Color as the Only Visual Indicator
```html
<!-- ❌ Bad - error only shown through red color -->
<input style="border-color: red" />

<!-- ✓ Good - error communicated through color + text + icon -->
<input aria-invalid="true" aria-describedby="email-error" style="border-color: red" />
<span id="email-error" role="alert">⚠ Please enter a valid email</span>
```

---

## Database Migrations

### Destructive Column Rename (Breaks Running Instances)
```sql
-- ❌ Bad - rename in one step while old code still reads 'username'
ALTER TABLE users RENAME COLUMN username TO display_name;

-- ✓ Good - expand/contract pattern
-- Step 1 (this PR): add new column, backfill, write to both
ALTER TABLE users ADD COLUMN display_name VARCHAR(255);
UPDATE users SET display_name = username;

-- Step 2 (later PR, after old code is gone): drop old column
ALTER TABLE users DROP COLUMN username;
```

### Non-Nullable Column Without Default (Breaks Inserts from Old Code)
```sql
-- ❌ Bad - existing code doesn't know about this column, inserts will fail
ALTER TABLE orders ADD COLUMN currency VARCHAR(3) NOT NULL;

-- ✓ Good - nullable or with a safe default
ALTER TABLE orders ADD COLUMN currency VARCHAR(3) NOT NULL DEFAULT 'USD';
-- or
ALTER TABLE orders ADD COLUMN currency VARCHAR(3);
```

### Missing Down Migration
```javascript
// ❌ Bad - no way to roll back
exports.up = async (knex) => {
  await knex.schema.createTable('sessions', ...)
}

// ✓ Good
exports.up = async (knex) => {
  await knex.schema.createTable('sessions', ...)
}
exports.down = async (knex) => {
  await knex.schema.dropTable('sessions')
}
```

### Locking Migration on Large Table
```sql
-- ❌ Bad - adding NOT NULL without default locks the table for a full rewrite
ALTER TABLE events ADD COLUMN processed BOOLEAN NOT NULL DEFAULT false;

-- ✓ Good - separate steps to avoid long lock
ALTER TABLE events ADD COLUMN processed BOOLEAN;           -- fast, no lock
UPDATE events SET processed = false WHERE processed IS NULL; -- batched separately
ALTER TABLE events ALTER COLUMN processed SET NOT NULL;     -- short lock once data is clean
ALTER TABLE events ALTER COLUMN processed SET DEFAULT false;
```

---

## Quick Reference

| Issue | Search Pattern | Severity |
|-------|---------------|----------|
| Hardcoded secrets | `grep -r "api_key.*=\|password.*="` | Critical |
| SQL injection | `grep -r "query.*+\|execute.*%"` | Critical |
| Console.log | `grep -r "console\\.log"` | Low |
| Any type | `grep -r ": any"` | Important |
| Type casting | `grep -r " as \|<.*>"` | Important |
| TODO | `grep -r "TODO\|FIXME"` | Varies |
