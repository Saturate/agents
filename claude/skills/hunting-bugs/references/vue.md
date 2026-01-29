# Vue Bug Patterns

## Contents
- Reactivity Issues (array mutations, destructuring, missing .value)
- Lifecycle Issues (missing cleanup, watch without cleanup)
- Component Issues (missing keys, mutating props, v-model)
- Template Issues (side effects, complex logic)
- Composition API Issues (forgetting return, reactive vs ref)
- Performance Issues (large reactive objects, expensive computed)
- Search Commands

Vue-specific bug patterns and anti-patterns (Vue 3 focused).

---

## Reactivity Issues

### Pattern: Direct Array Mutations

**Search:** `.push(`, `.splice(`, `.sort(` on reactive arrays

**Why it's problematic:**
In Vue 3 with `reactive()`, some direct mutations break reactivity tracking.

**Severity:** Medium

**Example:**
```typescript
// Bug
const state = reactive({ items: [] });
state.items.push(newItem); // May not trigger reactivity in some cases

// Fix
state.items = [...state.items, newItem];

// Or with ref
const items = ref([]);
items.value.push(newItem); // Works with ref
```

---

### Pattern: Losing Reactivity with Destructuring

**Search:** Destructuring reactive objects

**Why it's problematic:**
Loses reactivity connection.

**Severity:** High

**Example:**
```typescript
// Bug
const state = reactive({ count: 0 });
const { count } = state; // count is now a plain number, not reactive
count++; // Doesn't update UI

// Fix
const state = reactive({ count: 0 });
// Access via state.count, or use toRefs
const { count } = toRefs(state); // count is now a ref
count.value++; // Updates UI
```

---

### Pattern: Missing .value on Refs

**Search:** Ref usage without `.value` in script

**Why it's problematic:**
Accessing ref without `.value` gives ref object, not the value.

**Severity:** High

**Example:**
```typescript
// Bug
const count = ref(0);
console.log(count); // Ref { value: 0 }
if (count > 5) { } // Always false, comparing object

// Fix
console.log(count.value); // 0
if (count.value > 5) { }
```

**Note:** In template, `.value` is auto-unwrapped: `{{ count }}` works.

---

### Pattern: Computed Without Return

**Search:** `computed(` without return statement

**Why it's problematic:**
Computed returns undefined.

**Severity:** High

**Example:**
```typescript
// Bug
const fullName = computed(() => {
  firstName.value + ' ' + lastName.value; // Missing return
});

// Fix
const fullName = computed(() => {
  return firstName.value + ' ' + lastName.value;
});

// Or implicit return
const fullName = computed(() => firstName.value + ' ' + lastName.value);
```

---

## Lifecycle Issues

### Pattern: Missing Cleanup in onMounted

**Search:** `onMounted` with listeners/intervals but no `onUnmounted`

**Why it's problematic:**
Memory leaks from uncleaned listeners.

**Severity:** High

**Example:**
```typescript
// Bug
onMounted(() => {
  window.addEventListener('resize', handleResize);
});

// Fix
onMounted(() => {
  window.addEventListener('resize', handleResize);
});
onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
});
```

---

### Pattern: Watch Without Cleanup

**Search:** `watch` creating subscriptions without cleanup

**Why it's problematic:**
Memory leaks if watcher creates ongoing subscriptions.

**Severity:** Medium

**Example:**
```typescript
// Bug
watch(userId, (newId) => {
  const subscription = subscribeToUser(newId);
  // subscription never cleaned up
});

// Fix
watch(userId, (newId, oldId, onCleanup) => {
  const subscription = subscribeToUser(newId);
  onCleanup(() => {
    subscription.unsubscribe();
  });
});
```

---

## Component Issues

### Pattern: Missing Key in v-for

**Search:** `v-for` without `:key`

**Why it's problematic:**
Vue can't track items properly, causes re-renders and state bugs.

**Severity:** Medium

**Example:**
```vue
<!-- Bug -->
<div v-for="item in items">{{ item.name }}</div>

<!-- Fix -->
<div v-for="item in items" :key="item.id">{{ item.name }}</div>
```

**Never use index as key if list can reorder:**
```vue
<!-- Bug -->
<div v-for="(item, i) in items" :key="i">

<!-- Fix -->
<div v-for="item in items" :key="item.id">
```

---

### Pattern: Mutating Props

**Search:** `props.` followed by assignment in setup

**Why it's problematic:**
Props are read-only, mutating causes warnings and breaks one-way data flow.

**Severity:** High

**Example:**
```typescript
// Bug
const props = defineProps<{ count: number }>();
props.count++; // Warning: Mutating prop

// Fix - use local ref
const localCount = ref(props.count);
localCount.value++;

// Or emit event to parent
const emit = defineEmits<{ update: [value: number] }>();
emit('update', props.count + 1);
```

---

### Pattern: Incorrect v-model Usage

**Search:** `v-model` on computed without setter

**Why it's problematic:**
Cannot assign to read-only computed.

**Severity:** High

**Example:**
```typescript
// Bug
const fullName = computed(() => firstName.value + ' ' + lastName.value);
// <input v-model="fullName"> // Error: no setter

// Fix
const fullName = computed({
  get: () => firstName.value + ' ' + lastName.value,
  set: (value) => {
    const parts = value.split(' ');
    firstName.value = parts[0];
    lastName.value = parts[1];
  }
});
```

---

## Template Issues

### Pattern: Side Effects in Template Expressions

**Search:** Template expressions calling functions with side effects

**Why it's problematic:**
Template expressions run multiple times per render, causing unintended side effects.

**Severity:** Medium

**Example:**
```vue
<!-- Bug -->
<div>{{ saveData() }}</div> <!-- Called every render -->

<!-- Fix -->
<script setup>
onMounted(() => {
  saveData();
});
</script>
<div>{{ data }}</div>
```

---

### Pattern: Complex Logic in Templates

**Search:** Long template expressions with multiple operators

**Why it's problematic:**
Hard to read, debug, and test.

**Severity:** Low

**Example:**
```vue
<!-- Bug -->
<div v-if="user && user.age > 18 && user.verified && !user.banned">

<!-- Fix -->
<script setup>
const canAccess = computed(() =>
  user.value?.age > 18 &&
  user.value?.verified &&
  !user.value?.banned
);
</script>
<div v-if="canAccess">
```

---

## Composition API Issues

### Pattern: Forgetting to Return from setup

**Search:** `setup()` without return statement

**Why it's problematic:**
Template can't access reactive values.

**Severity:** High

**Example:**
```typescript
// Bug
setup() {
  const count = ref(0);
  // Missing return
}

// Fix
setup() {
  const count = ref(0);
  return { count };
}

// Or use script setup (auto-returns)
<script setup>
const count = ref(0);
</script>
```

---

### Pattern: Using reactive() Instead of ref() for Primitives

**Search:** `reactive(` with primitives

**Why it's problematic:**
`reactive()` only works with objects, primitives need `ref()`.

**Severity:** Medium

**Example:**
```typescript
// Bug
const count = reactive(0); // Doesn't work, not reactive

// Fix
const count = ref(0);
```

---

## Performance Issues

### Pattern: Large Objects in Reactive

**Search:** `reactive(` with very large objects

**Why it's problematic:**
Vue deeply observes all properties, can be slow.

**Severity:** Medium

**Example:**
```typescript
// Bug
const data = reactive(largeDataArray); // Deep reactivity for all items

// Fix - Use shallowReactive if nested reactivity not needed
const data = shallowReactive(largeDataArray);

// Or markRaw for non-reactive data
const data = markRaw(largeDataArray);
```

---

### Pattern: Expensive Computed Without Caching

**Search:** Functions called multiple times in template

**Why it's problematic:**
Recomputes on every access.

**Severity:** Low

**Example:**
```vue
<!-- Bug -->
<div>{{ getFilteredItems() }}</div> <!-- Recomputes every render -->

<!-- Fix -->
<script setup>
const filteredItems = computed(() => getFilteredItems());
</script>
<div>{{ filteredItems }}</div>
```

---

## Search Commands

**Find missing keys in v-for:**
```bash
grep -r "v-for" --include="*.vue" | grep -v ":key"
```

**Find ref without .value:**
```bash
grep -A5 "ref(" --include="*.vue" --include="*.ts" | grep -v "\.value"
```

**Find prop mutations:**
```bash
grep -A10 "defineProps" --include="*.vue" | grep "props\.\w* ="
```

**Find missing cleanup:**
```bash
grep -r "onMounted" --include="*.vue" | grep -v "onUnmounted"
```

**Find computed without return:**
```bash
grep -A3 "computed(" --include="*.vue" | grep -v "return"
```
