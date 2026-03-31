# TypeScript & JavaScript Issues

Reference for: PR Review

Load when diff contains `*.ts`, `*.tsx`, `*.js`, `*.jsx`, `*.vue`, `*.svelte` files.

## Table of Contents

1. [Type Safety Violations](#type-safety-violations)
2. [TypeScript Anti-Patterns](#typescript-anti-patterns)
3. [Error Handling](#error-handling)
4. [Performance](#performance)
5. [UI & Accessibility](#ui--accessibility)
6. [Testing](#testing)
7. [Quick Reference](#quick-reference)

---

## Type Safety Violations

**Critical:** Type casts and assertions bypass TypeScript's safety checks. Most projects forbid these — check CLAUDE.md.

### Type Casting Instead of Narrowing

Bad — Type Assertion:
```typescript
if (content.entry.itemType === 'IRedirectViewModel') {
  const redirect = content.entry.item as IRedirect  // Bypasses type checking
}
```

Good — Discriminated Union:
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
}
```

Good — Type Guard:
```typescript
function isRedirect(item: unknown): item is IRedirect {
  return (
    item !== null &&
    typeof item === 'object' &&
    'targetUrl' in item &&
    typeof item.targetUrl === 'string'
  )
}

if (isRedirect(content.entry.item)) {
  navigateTo(content.entry.item.targetUrl)  // Safely narrowed
}
```

Good — Validation Library:
```typescript
import { z } from 'zod'

const RedirectSchema = z.object({
  targetUrl: z.string(),
  statusCode: z.number()
})

const redirect = RedirectSchema.parse(content.entry.item)  // Validated at runtime
```

### Non-Null Assertion

```typescript
// Bad
const user = users.find(u => u.id === userId)!
console.log(user.name)  // Runtime error if undefined

// Good
const user = users.find(u => u.id === userId)
if (!user) {
  throw new Error(`User ${userId} not found`)
}
console.log(user.name)  // Safe
```

### Double Assertion

```typescript
// Never do this — your type definitions are wrong
const value = input as unknown as SomeType
```

## TypeScript Anti-Patterns

### Explicit Any
```typescript
// Bad
function process(data: any) {
  return data.value;
}

// Good
function process(data: { value: string }) {
  return data.value;
}
```

### Missing Return Type on Public APIs
```typescript
// Bad — inferred return type can drift
async function fetchUser(id: string) {
  return await db.users.findById(id);
}

// Good
async function fetchUser(id: string): Promise<User | null> {
  return await db.users.findById(id);
}
```

## Error Handling

### Swallowed Errors
```javascript
// Bad
try {
  await riskyOperation();
} catch (e) {
  // Silent failure
}

// Good
try {
  await riskyOperation();
} catch (error) {
  logger.error('Operation failed', { error, context });
  throw new OperationError('Failed to complete operation');
}
```

### Missing Null Checks
```javascript
// Bad
const name = user.profile.name.toUpperCase();

// Good
const name = user?.profile?.name?.toUpperCase() ?? 'Unknown';
```

### Unhandled Promise Rejections
```javascript
// Bad
async function loadData() {
  const data = await fetchData(); // Can reject, no catch
  return data;
}

// Good
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
// Bad
for (const post of posts) {
  post.author = await User.findById(post.authorId);
}

// Good
const authorIds = posts.map(p => p.authorId);
const authors = await User.findByIds(authorIds);
const authorMap = new Map(authors.map(a => [a.id, a]));
posts.forEach(post => {
  post.author = authorMap.get(post.authorId);
});
```

### Missing Indexes
```javascript
// Bad: querying without index
User.find({ email: 'user@example.com' });

// Good: add index in migration
await db.createIndex('users', { email: 1 });
```

### Unnecessary Re-renders
```jsx
// Bad
function Component({ data }) {
  const processed = expensiveOperation(data); // Runs every render
  return <div>{processed}</div>;
}

// Good
function Component({ data }) {
  const processed = useMemo(() => expensiveOperation(data), [data]);
  return <div>{processed}</div>;
}
```

## UI & Accessibility

### Missing Alt Text
```html
<!-- Bad -->
<img src="chart.png" />

<!-- Good — descriptive -->
<img src="chart.png" alt="Monthly revenue growth from $10k to $45k over 6 months" />

<!-- Good — decorative, hidden from screen readers -->
<img src="divider.png" alt="" />
```

### Keyboard Inaccessible Interactive Elements
```html
<!-- Bad — div click handler is not keyboard accessible -->
<div onClick={handleDelete}>Delete</div>

<!-- Good -->
<button onClick={handleDelete}>Delete</button>

<!-- Good — if you must use a non-semantic element -->
<div role="button" tabIndex={0} onClick={handleDelete} onKeyDown={e => e.key === 'Enter' && handleDelete()}>
  Delete
</div>
```

### Missing Form Labels
```html
<!-- Bad -->
<input type="email" placeholder="Email address" />

<!-- Good — explicit label -->
<label htmlFor="email">Email address</label>
<input id="email" type="email" />

<!-- Good — aria-label when visible label isn't possible -->
<input type="search" aria-label="Search products" />
```

### Focus Not Managed After Dynamic Changes
```typescript
// Bad — modal opens but focus stays behind it
function openModal() {
  setModalOpen(true)
}

// Good — move focus into modal when it opens
function openModal() {
  setModalOpen(true)
  requestAnimationFrame(() => {
    modalRef.current?.focus()
  })
}
```

### Color as the Only Visual Indicator
```html
<!-- Bad — error only shown through red color -->
<input style="border-color: red" />

<!-- Good — error communicated through color + text + icon -->
<input aria-invalid="true" aria-describedby="email-error" style="border-color: red" />
<span id="email-error" role="alert">Please enter a valid email</span>
```

## Testing

### Testing Implementation Details
```javascript
// Bad
expect(component.state.count).toBe(1);

// Good — test behavior, not internals
expect(screen.getByText('Count: 1')).toBeInTheDocument();
```

### Brittle Selectors
```javascript
// Bad
await page.click('.MuiButton-root:nth-child(2)');

// Good
await page.click('[data-testid="submit-button"]');
```

### Missing Edge Cases
```javascript
// Bad: only tests happy path
test('divides numbers', () => {
  expect(divide(10, 2)).toBe(5);
});

// Good: tests edge cases
test('divides numbers', () => {
  expect(divide(10, 2)).toBe(5);
  expect(divide(10, 3)).toBeCloseTo(3.33);
  expect(() => divide(10, 0)).toThrow('Division by zero');
  expect(divide(0, 10)).toBe(0);
});
```

---

## Quick Reference

| Issue | Search Pattern | Severity |
|-------|---------------|----------|
| Any type | `grep -r ": any"` | Important |
| Type casting | `grep -r " as \|<.*>"` | Important |
| Non-null assertion | `grep -r "!\."` | Important |
| Console.log | `grep -r "console\\.log"` | Low |
| Floating promises | `grep -r "(?<!await )someAsyncFn("` | Important |
| Missing alt text | `grep -r "<img" \| grep -v "alt="` | Important |
| Div click handler | `grep -r "<div.*onClick"` | Important |
