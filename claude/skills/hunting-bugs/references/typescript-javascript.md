# TypeScript/JavaScript Bug Patterns

## Contents
- Timezone/Date Handling (UTC conversion bugs)
- TypeScript Type Safety (any, type assertions, non-null assertions)
- Null/Undefined Safety (optional chaining, array access)
- Async/Promise Handling (missing await, error handling)
- Search Commands

Most common, high-impact bug patterns in TypeScript codebases.

---

## Timezone/Date Handling (Very Common)

### Pattern: UTC Conversion in Date Formatting

**Search:** `.toISOString().split('T')[0]` or `.toISOString().substring(0, 10)`

**Why it's problematic:**
Converts local dates to UTC before formatting. Users in positive UTC offset timezones (CET, JST, AEST) see dates off by 1 day.

**Severity:** High

**Example:**
```typescript
// Bug: User selects Feb 1 in CET (UTC+1)
const date = new Date('2024-02-01T00:00:00');
const formatted = date.toISOString().split('T')[0]; // "2024-01-31" ❌

// Fix: Use local timezone methods
const formatLocalDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
const formatted = formatLocalDate(date); // "2024-02-01" ✅
```

**When it's OK:**
- Storing UTC timestamps in database
- API requires ISO 8601 UTC format

---

## TypeScript Type Safety

### Pattern: Using `any` Type

**Search:** `: any` or `as any`

**Why it's problematic:**
Disables type checking, allows runtime errors. Code using `any` is much more likely to fail.

**Severity:** High

**Example:**
```typescript
// Bug
function process(data: any) {
  return data.value.nested.property; // No type checking, crashes if structure wrong
}

// Fix
interface Data {
  value: {
    nested: {
      property: string;
    };
  };
}
function process(data: Data) {
  return data.value.nested.property; // Type-safe
}

// Or unknown if type truly unknown
function process(data: unknown) {
  if (isData(data)) {
    return data.value.nested.property;
  }
}
```

---

### Pattern: Type Assertions Without Validation

**Search:** `as` casts without runtime checks

**Why it's problematic:**
Type assertion tells TypeScript "trust me", but if you're wrong, runtime errors occur.

**Severity:** High

**Example:**
```typescript
// Bug
const user = response.data as User; // No validation, crashes if wrong shape
console.log(user.profile.name);

// Fix
function isUser(data: unknown): data is User {
  return typeof data === 'object' && data !== null &&
    'profile' in data && typeof (data as any).profile === 'object';
}

const data = response.data;
if (isUser(data)) {
  console.log(data.profile.name); // Type-safe
}
```

---

### Pattern: Non-null Assertion Without Check

**Search:** `!` operator (e.g., `value!`)

**Why it's problematic:**
Tells TypeScript value is non-null, but if it is null, crashes occur.

**Severity:** High

**Example:**
```typescript
// Bug
const user = users.find(u => u.id === id)!; // Crashes if not found
console.log(user.name);

// Fix
const user = users.find(u => u.id === id);
if (user) {
  console.log(user.name);
}

// Or with fallback
const user = users.find(u => u.id === id) ?? defaultUser;
```

---

## Null/Undefined Safety

### Pattern: Deep Property Access Without Optional Chaining

**Search:** `\w+\.\w+\.\w+` (3+ levels without `?.`)

**Why it's problematic:**
Throws "Cannot read property of undefined" if any intermediate value is null/undefined.

**Severity:** High

**Example:**
```typescript
// Bug
const name = user.profile.name; // Crashes if profile is undefined

// Fix
const name = user?.profile?.name;
const name = user?.profile?.name ?? 'Unknown';
```

---

### Pattern: Array Access Without Bounds Check

**Search:** `array[0]` followed by property access

**Why it's problematic:**
Returns undefined if array empty, then property access crashes.

**Severity:** Medium

**Example:**
```typescript
// Bug
const first = items[0].name; // Crashes if items is empty

// Fix
const first = items[0]?.name;
const first = items.at(0)?.name;
```

---

## Async/Promise Handling

### Pattern: Missing Await

**Search:** Promise-returning calls without `await` in async function

**Why it's problematic:**
Race conditions, incomplete operations.

**Severity:** High

**Example:**
```typescript
// Bug
async function process() {
  saveToDatabase(data); // Returns promise but not awaited
  return 'done'; // Returns before save completes
}

// Fix
async function process() {
  await saveToDatabase(data);
  return 'done';
}
```

---

### Pattern: Async Functions Without Error Handling

**Search:** `async function` without `try/catch`

**Why it's problematic:**
Unhandled errors become unhandled promise rejections.

**Severity:** High

**Example:**
```typescript
// Bug
async function fetchData() {
  const response = await fetch('/api/data');
  return response.json();
}

// Fix
async function fetchData() {
  try {
    const response = await fetch('/api/data');
    return response.json();
  } catch (error) {
    console.error('Failed to fetch:', error);
    throw error;
  }
}
```

---

## Search Commands

**Find timezone bugs:**
```bash
grep -r "toISOString().split" --include="*.ts"
```

**Find any usage:**
```bash
grep -r ": any\|as any" --include="*.ts"
```

**Find type assertions:**
```bash
grep -r " as " --include="*.ts"
```

**Find non-null assertions:**
```bash
grep -r "!" --include="*.ts" | grep -v "!=" | grep -v "!=="
```

**Find missing await:**
```bash
grep -B2 -A2 "async" --include="*.ts" | grep -v "await"
```
