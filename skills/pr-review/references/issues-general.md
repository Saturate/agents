# General Code Review Issues

Reference for: PR Review

Issues that apply regardless of tech stack. Always load this file.

## Table of Contents

1. [Security](#security)
2. [Logic Bugs](#logic-bugs)
3. [Code Quality](#code-quality)
4. [Database Migrations](#database-migrations)
5. [Quick Reference](#quick-reference)

---

## Security

### Hardcoded Secrets
```javascript
// Bad
const API_KEY = "sk_live_abc123";

// Good
const API_KEY = process.env.API_KEY;
```

### SQL Injection
```javascript
// Bad
const query = `SELECT * FROM users WHERE id = ${userId}`;

// Good
const query = 'SELECT * FROM users WHERE id = $1';
db.query(query, [userId]);
```

### XSS Vulnerabilities
```jsx
// Bad
<div dangerouslySetInnerHTML={{__html: userInput}} />

// Good
<div>{DOMPurify.sanitize(userInput)}</div>
```

### Weak Password Requirements
```javascript
// Bad
if (password.length < 6) return false;

// Good
if (password.length < 12 || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
  return false;
}
```

## Logic Bugs

### Off-by-One Errors
```javascript
// Bad
for (let i = 0; i <= array.length; i++) {  // <= is wrong
  console.log(array[i]);
}

// Good
for (let i = 0; i < array.length; i++) {
  console.log(array[i]);
}
```

### Race Conditions
```javascript
// Bad
let counter = 0;
async function increment() {
  const current = counter;
  await someAsyncOperation();
  counter = current + 1; // Race condition
}

// Good
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
// Bad
if (value == null) { // Matches both null and undefined

// Good
if (value === null) { // Only null
if (value === undefined) { // Only undefined
if (value == null) { // Explicitly want both (rare, comment why)
```

## Code Quality

### Magic Numbers
```javascript
// Bad
setTimeout(cleanup, 86400000);

// Good
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
setTimeout(cleanup, ONE_DAY_MS);
```

### Deeply Nested Code
```javascript
// Bad
if (user) {
  if (user.isActive) {
    if (user.hasPermission) {
      if (!user.isBanned) {
        doSomething();
      }
    }
  }
}

// Good — early returns
if (!user) return;
if (!user.isActive) return;
if (!user.hasPermission) return;
if (user.isBanned) return;
doSomething();
```

### Poor Variable Names
```javascript
// Bad
const d = new Date();
const x = users.filter(u => u.a);

// Good
const currentDate = new Date();
const activeUsers = users.filter(user => user.isActive);
```

### Commented-Out Code
```javascript
// Bad — use git for history
function process(data) {
  // const old = transform(data);
  // return old.map(x => x.value);
  return data.map(item => item.value);
}

// Good
function process(data) {
  return data.map(item => item.value);
}
```

## Database Migrations

### Destructive Column Rename
```sql
-- Bad — rename in one step while old code still reads 'username'
ALTER TABLE users RENAME COLUMN username TO display_name;

-- Good — expand/contract pattern
-- Step 1 (this PR): add new column, backfill, write to both
ALTER TABLE users ADD COLUMN display_name VARCHAR(255);
UPDATE users SET display_name = username;

-- Step 2 (later PR, after old code is gone): drop old column
ALTER TABLE users DROP COLUMN username;
```

### Non-Nullable Column Without Default
```sql
-- Bad — existing code doesn't know about this column, inserts will fail
ALTER TABLE orders ADD COLUMN currency VARCHAR(3) NOT NULL;

-- Good — nullable or with a safe default
ALTER TABLE orders ADD COLUMN currency VARCHAR(3) NOT NULL DEFAULT 'USD';
```

### Missing Down Migration
```javascript
// Bad — no way to roll back
exports.up = async (knex) => {
  await knex.schema.createTable('sessions', ...)
}

// Good
exports.up = async (knex) => {
  await knex.schema.createTable('sessions', ...)
}
exports.down = async (knex) => {
  await knex.schema.dropTable('sessions')
}
```

### Locking Migration on Large Table
```sql
-- Bad — adding NOT NULL without default locks the table for a full rewrite
ALTER TABLE events ADD COLUMN processed BOOLEAN NOT NULL DEFAULT false;

-- Good — separate steps to avoid long lock
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
| TODO | `grep -r "TODO\|FIXME"` | Varies |
| Console.log | `grep -r "console\\.log"` | Low |
