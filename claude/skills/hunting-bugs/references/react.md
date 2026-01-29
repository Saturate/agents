# React Bug Patterns

## Contents
- State Management (mutations, missing deps, missing cleanup)
- Performance Issues (missing memoization, inline objects/arrays)
- Component Issues (missing keys, conditional hooks, hooks in loops)
- Event Handling (incorrect handlers, missing preventDefault)
- Search Commands

React-specific bug patterns and anti-patterns.

---

## State Management

### Pattern: Direct State Mutation

**Search:** `state.property =` or `array.push(` in component

**Why it's problematic:**
React won't detect the change and won't re-render.

**Severity:** High

**Example:**
```typescript
// Bug
const [items, setItems] = useState([]);
items.push(newItem); // Mutates state directly
setItems(items); // React sees same reference, no re-render

// Fix
setItems([...items, newItem]);
setItems(items.concat(newItem));
```

---

### Pattern: Missing Dependencies in useEffect

**Search:** `useEffect` with empty deps but using external values

**Why it's problematic:**
Stale closures - effect captures old values.

**Severity:** High

**Example:**
```typescript
// Bug
const [count, setCount] = useState(0);
useEffect(() => {
  const interval = setInterval(() => {
    console.log(count); // Always logs 0
  }, 1000);
  return () => clearInterval(interval);
}, []); // Missing count

// Fix
useEffect(() => {
  const interval = setInterval(() => {
    console.log(count);
  }, 1000);
  return () => clearInterval(interval);
}, [count]); // Include dependency
```

---

### Pattern: Missing Cleanup in useEffect

**Search:** `useEffect` with subscriptions/listeners but no return function

**Why it's problematic:**
Memory leaks from accumulating listeners.

**Severity:** High

**Example:**
```typescript
// Bug
useEffect(() => {
  window.addEventListener('resize', handleResize);
}, []);

// Fix
useEffect(() => {
  window.addEventListener('resize', handleResize);
  return () => window.removeEventListener('resize', handleResize);
}, []);
```

---

### Pattern: setState in Render

**Search:** `setState` or `setCount` calls in component body (not in handler/effect)

**Why it's problematic:**
Infinite render loop.

**Severity:** Critical

**Example:**
```typescript
// Bug
function Component() {
  const [count, setCount] = useState(0);
  setCount(count + 1); // Infinite loop!
  return <div>{count}</div>;
}

// Fix
function Component() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    setCount(count + 1);
  }, []); // Run once on mount
  return <div>{count}</div>;
}
```

---

## Performance Issues

### Pattern: Missing useMemo for Expensive Calculations

**Search:** Complex calculations in render without `useMemo`

**Why it's problematic:**
Recalculates on every render.

**Severity:** Medium

**Example:**
```typescript
// Bug
function Component({ items }) {
  const sortedItems = items.sort((a, b) => a.value - b.value); // Sorts every render
  return <List items={sortedItems} />;
}

// Fix
function Component({ items }) {
  const sortedItems = useMemo(
    () => items.sort((a, b) => a.value - b.value),
    [items]
  );
  return <List items={sortedItems} />;
}
```

---

### Pattern: Missing useCallback for Event Handlers

**Search:** Inline functions passed as props

**Why it's problematic:**
Creates new function on every render, breaking memoization of child components.

**Severity:** Low (unless child is expensive)

**Example:**
```typescript
// Bug
function Parent() {
  return <ExpensiveChild onClick={() => console.log('click')} />;
  // New function every render, breaks React.memo
}

// Fix
function Parent() {
  const handleClick = useCallback(() => {
    console.log('click');
  }, []);
  return <ExpensiveChild onClick={handleClick} />;
}
```

---

### Pattern: Inline Object/Array in Props

**Search:** `prop={{` or `prop={[`

**Why it's problematic:**
New reference every render, breaks memoization.

**Severity:** Low

**Example:**
```typescript
// Bug
<Component style={{ margin: 10 }} /> // New object every render

// Fix
const style = { margin: 10 }; // Outside component
<Component style={style} />

// Or useMemo
const style = useMemo(() => ({ margin: 10 }), []);
<Component style={style} />
```

---

## Component Issues

### Pattern: Missing Key in Lists

**Search:** `.map()` without `key` prop

**Why it's problematic:**
React can't track items, causes re-renders and lost state.

**Severity:** Medium

**Example:**
```typescript
// Bug
{items.map(item => <Item data={item} />)}

// Fix
{items.map(item => <Item key={item.id} data={item} />)}
```

**Never use index as key if list can reorder:**
```typescript
// Bug
{items.map((item, i) => <Item key={i} data={item} />)} // Breaks if list reorders

// Fix
{items.map(item => <Item key={item.id} data={item} />)} // Use stable ID
```

---

### Pattern: Conditional Hooks

**Search:** `if` or `&&` before `useState`, `useEffect`, etc.

**Why it's problematic:**
Breaks Rules of Hooks, causes crashes.

**Severity:** Critical

**Example:**
```typescript
// Bug
function Component({ isLoggedIn }) {
  if (isLoggedIn) {
    const [user, setUser] = useState(null); // ❌ Conditional hook
  }
}

// Fix
function Component({ isLoggedIn }) {
  const [user, setUser] = useState(null); // ✅ Always call
  if (!isLoggedIn) return null;
}
```

---

### Pattern: Hooks in Loops

**Search:** `useState` or `useEffect` inside `for`, `while`, `.map()`

**Why it's problematic:**
Breaks Rules of Hooks.

**Severity:** Critical

**Example:**
```typescript
// Bug
function Component({ items }) {
  items.forEach(item => {
    const [value, setValue] = useState(0); // ❌ Hook in loop
  });
}

// Fix - Use single state for all items
function Component({ items }) {
  const [values, setValues] = useState({});
}
```

---

## Event Handling

### Pattern: Event Handler in JSX Calling Function

**Search:** `onClick={handleClick()}` with parentheses

**Why it's problematic:**
Calls function immediately on render instead of on click.

**Severity:** High

**Example:**
```typescript
// Bug
<button onClick={handleClick()}>Click</button> // Calls immediately

// Fix
<button onClick={handleClick}>Click</button>
<button onClick={() => handleClick()}>Click</button> // If you need to pass args
```

---

### Pattern: Missing preventDefault/stopPropagation

**Search:** Form handlers without `e.preventDefault()`

**Why it's problematic:**
Form submissions cause page reload.

**Severity:** Medium

**Example:**
```typescript
// Bug
<form onSubmit={handleSubmit}>

function handleSubmit(e) {
  saveData(); // Page reloads before this completes
}

// Fix
function handleSubmit(e) {
  e.preventDefault();
  saveData();
}
```

---

## Search Commands

**Find missing keys:**
```bash
grep -r "\.map(" --include="*.tsx" --include="*.jsx" | grep -v "key="
```

**Find conditional hooks:**
```bash
grep -B2 "useState\|useEffect" --include="*.tsx" --include="*.jsx" | grep "if ("
```

**Find setState in render:**
```bash
grep -A10 "function.*Component" --include="*.tsx" | grep "setState"
```

**Find missing cleanup:**
```bash
grep -A5 "useEffect" --include="*.tsx" | grep "addEventListener" | grep -v "return"
```
