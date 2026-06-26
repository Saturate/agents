# Rust Issues

Reference for: PR Review

Load when diff contains `*.rs`, `Cargo.toml`, `Cargo.lock` files.

## Table of Contents

1. [Unsafe Code](#unsafe-code)
2. [Error Handling](#error-handling)
3. [Ownership & Borrowing](#ownership--borrowing)
4. [Concurrency](#concurrency)
5. [Performance](#performance)
6. [API Design](#api-design)
7. [Serde & Serialization](#serde--serialization)
8. [Integer Overflow & Type Casting](#integer-overflow--type-casting)
9. [Async (Tokio)](#async-tokio)
10. [Security](#security)
11. [Defensive Patterns](#defensive-patterns)
12. [Testing](#testing)
13. [Quick Reference](#quick-reference)

---

## Unsafe Code

### Unjustified unsafe Block
```rust
// Bad — unsafe without explanation
unsafe {
    ptr::copy_nonoverlapping(src, dst, len);
}

// Good — safety invariant documented
// SAFETY: src and dst do not overlap; both point to
// len initialized elements within allocated bounds.
unsafe {
    ptr::copy_nonoverlapping(src, dst, len);
}
```

### unsafe fn Without Safe Wrapper
```rust
// Bad — forces callers to reason about invariants
pub unsafe fn from_raw_parts(ptr: *const u8, len: usize) -> Self { ... }

// Good — encapsulate in a safe API with validation
pub fn from_bytes(bytes: &[u8]) -> Result<Self, Error> {
    // validate, then call unsafe internally
}
```

### Transmute When as-cast or From Suffices
```rust
// Bad — transmute hides conversions
let x: u32 = unsafe { std::mem::transmute(my_f32) };

// Good — explicit bit reinterpretation
let x: u32 = my_f32.to_bits();
```

## Error Handling

### Unwrap in Library Code
```rust
// Bad — panics on None/Err
let value = map.get("key").unwrap();
let data = file.read_to_string().unwrap();

// Good — propagate or provide context
let value = map.get("key").ok_or_else(|| Error::MissingKey("key"))?;
let data = file.read_to_string().map_err(|e| Error::ReadFailed(path, e))?;
```

### Opaque Error Messages
```rust
// Bad — no context about what failed
Err(anyhow!("invalid input"))

// Good — include the failing value
Err(anyhow!("version string {:?} does not match pattern X.Y.Z", input))
```

### Using String as Error Type
```rust
// Bad — stringly typed errors
fn parse(s: &str) -> Result<Config, String> {
    Err(format!("bad config"))
}

// Good — typed errors
#[derive(Debug, thiserror::Error)]
enum ParseError {
    #[error("missing field {0}")]
    MissingField(&'static str),
    #[error("invalid value for {field}: {value}")]
    InvalidValue { field: &'static str, value: String },
}
```

### Silencing Results with let _ =
```rust
// Bad — discarding a Result silently
let _ = file.sync_all();

// Good — at minimum log it
if let Err(e) = file.sync_all() {
    tracing::warn!("fsync failed: {e}");
}
```

## Ownership & Borrowing

### Unnecessary Clone
```rust
// Bad — cloning to satisfy borrow checker instead of restructuring
let name = user.name.clone();
process(&name);

// Good — borrow directly
process(&user.name);
```

### Taking Owned String When &str Suffices
```rust
// Bad — forces caller to allocate
fn greet(name: String) { println!("hi {name}"); }

// Good — accept a borrow
fn greet(name: &str) { println!("hi {name}"); }

// Also good — generic over owned and borrowed
fn greet(name: impl AsRef<str>) { println!("hi {}", name.as_ref()); }
```

### Returning References to Temporaries
```rust
// Bad — won't compile, but shows the intent mistake
fn first_word(s: &str) -> &str {
    let owned = s.to_uppercase(); // temporary
    &owned[..1] // dangling
}

// Good — return owned data
fn first_word(s: &str) -> String {
    s[..1].to_uppercase()
}
```

## Concurrency

### Mutex Held Across Await
```rust
// Bad — MutexGuard held across .await blocks other tasks
let guard = mutex.lock().unwrap();
let result = async_operation().await; // guard still held
drop(guard);

// Good — drop guard before awaiting
let data = {
    let guard = mutex.lock().unwrap();
    guard.clone()
};
let result = async_operation().await;
```

### Arc<Mutex<T>> When Channel Would Be Simpler
```rust
// Bad — shared mutable state with lock contention
let state = Arc::new(Mutex::new(Vec::new()));

// Good — if only one consumer, use a channel
let (tx, rx) = mpsc::channel();
```

### Missing Send/Sync Bounds on Async Tasks
```rust
// Bad — fails to compile with a confusing error about Send
fn spawn_task<T>(value: T) {
    tokio::spawn(async move { process(value) });
}

// Good — state the bound explicitly for clear errors
fn spawn_task<T: Send + 'static>(value: T) {
    tokio::spawn(async move { process(value) });
}
```

## Performance

### Collecting When Iterating Suffices
```rust
// Bad — allocates intermediate Vec
let names: Vec<String> = users.iter().map(|u| u.name.clone()).collect();
for name in &names {
    println!("{name}");
}

// Good — iterate directly
for name in users.iter().map(|u| &u.name) {
    println!("{name}");
}
```

### String Formatting in Hot Path
```rust
// Bad — allocates on every call
fn log_metric(name: &str, value: f64) {
    let msg = format!("{name}={value}");
    buffer.push(msg);
}

// Good — use write! to avoid allocation
use std::fmt::Write;
fn log_metric(name: &str, value: f64, buf: &mut String) {
    write!(buf, "{name}={value}\n").unwrap();
}
```

### Box<dyn Trait> When Generics Work
```rust
// Bad — dynamic dispatch and heap allocation when monomorphization works
fn process(handler: Box<dyn Handler>) { handler.handle(); }

// Good — zero-cost static dispatch
fn process(handler: impl Handler) { handler.handle(); }
```

### Not Using Entry API for Maps
```rust
// Bad — double lookup
if !map.contains_key(&key) {
    map.insert(key, compute_value());
}

// Good — single lookup
map.entry(key).or_insert_with(|| compute_value());
```

## API Design

### bool Parameters
```rust
// Bad — caller reads as process(data, true, false)
fn process(data: &[u8], validate: bool, compress: bool) {}

// Good — use an enum or builder
enum Validation { On, Off }
enum Compression { Enabled, Disabled }
fn process(data: &[u8], validate: Validation, compress: Compression) {}
```

### Returning impl Trait When Trait Object Is Needed
```rust
// Bad — can't store or use dynamically
fn create_handler() -> impl Handler { ... }

// Good — if caller needs to store it
fn create_handler() -> Box<dyn Handler> { ... }

// Also good — if caller doesn't need to store it, impl Trait is fine
```

### Leaking Internal Types in Public API
```rust
// Bad — exposes internal dependency
pub fn connection(&self) -> &diesel::PgConnection { ... }

// Good — wrap in your own type or return a trait
pub fn execute(&self, query: &str) -> Result<Rows> { ... }
```

## Serde & Serialization

### Deriving Debug on Sensitive Fields
```rust
// Bad — logs plaintext passwords
#[derive(Debug, Serialize, Deserialize)]
struct User {
    username: String,
    password: String,
}

// Good — redact sensitive fields
impl std::fmt::Debug for User {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("User")
            .field("username", &self.username)
            .field("password", &"[REDACTED]")
            .finish()
    }
}
```

### serde(default) on Sensitive Fields
```rust
// Bad — accepts empty password on deserialization
#[derive(Deserialize)]
struct Credentials {
    #[serde(default)]
    password: String,
}

// Good — validate via TryFrom
#[derive(Deserialize)]
#[serde(try_from = "RawCredentials")]
struct Credentials { password: String }

impl TryFrom<RawCredentials> for Credentials {
    type Error = &'static str;
    fn try_from(raw: RawCredentials) -> Result<Self, Self::Error> {
        if raw.password.is_empty() { return Err("password required"); }
        Ok(Credentials { password: raw.password })
    }
}
```

### Missing #[serde(deny_unknown_fields)]
```rust
// Bad — silently ignores typos in config files
#[derive(Deserialize)]
struct Config {
    port: u16,
    host: String,
}

// Good — rejects unknown fields
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Config {
    port: u16,
    host: String,
}
```

## Integer Overflow & Type Casting

### Unchecked Arithmetic in Release
```rust
// Bad — wraps silently in release mode
fn total_price(price: u32, quantity: u32) -> u32 {
    price * quantity
}

// Good — checked arithmetic
fn total_price(price: u32, quantity: u32) -> Option<u32> {
    price.checked_mul(quantity)
}
```

### Silent Truncation with as
```rust
// Bad — silently truncates
let x: i32 = 300;
let y: i8 = x as i8; // y == 44

// Good — explicit fallible conversion
let y = i8::try_from(x)?;
```

## Async (Tokio)

### Blocking Call in Async Task
```rust
// Bad — blocks the tokio worker thread
async fn read_config() -> String {
    std::fs::read_to_string("config.toml").unwrap()
}

// Good — use async fs or spawn_blocking
async fn read_config() -> String {
    tokio::fs::read_to_string("config.toml").await.unwrap()
}
// or for CPU-heavy work:
tokio::task::spawn_blocking(|| heavy_computation()).await.unwrap()
```

### block_on Inside Async Runtime
```rust
// Bad — deadlocks the runtime
async fn handler() {
    let rt = tokio::runtime::Runtime::new().unwrap();
    rt.block_on(some_future()); // deadlock
}

// Good — just .await
async fn handler() {
    some_future().await;
}
```

### std::sync::Mutex in Async Code
```rust
// Bad — blocks runtime thread while waiting for lock
use std::sync::Mutex;
async fn update(state: &Mutex<Vec<u8>>) {
    let mut guard = state.lock().unwrap();
    async_operation().await; // guard held across await
    guard.push(1);
}

// Good — use tokio::sync::Mutex or drop before await
use tokio::sync::Mutex;
async fn update(state: &Mutex<Vec<u8>>) {
    let mut guard = state.lock().await;
    guard.push(1);
}
```

## Security

### Unchecked Index Access
```rust
// Bad — panics on out-of-bounds
let value = data[user_index];

// Good — return Option
let value = data.get(user_index).ok_or(Error::IndexOutOfBounds)?;
```

### Timing-Sensitive Comparison
```rust
// Bad — early return leaks info via timing
fn verify(input: &[u8], expected: &[u8]) -> bool {
    input == expected
}

// Good — constant-time comparison
use subtle::ConstantTimeEq;
fn verify(input: &[u8], expected: &[u8]) -> bool {
    input.ct_eq(expected).into()
}
```

## Defensive Patterns

### Excessive Rc<RefCell<T>>
```rust
// Bad — runtime panics from double borrows
let counter = Rc::new(RefCell::new(DamageCounter::default()));
monster.add_listener(Box::new(move |damage| {
    counter.borrow_mut().on_damage_received(damage) // panics if already borrowed
}));

// Good — restructure to avoid interior mutability
target.take_damage(damage, |dmg| counter.on_damage_received(dmg));
```

### Initialize After Construction
```rust
// Bad — object exists in invalid state
let mut dict = Dictionary::new();
dict.load_from_file("./words.txt")?;

// Good — valid on construction or error
let dict = Dictionary::from_file("./words.txt")?;
```

### TOCTOU on File Paths
```rust
// Bad — path can be swapped between check and use
fs::remove_file(to)?;
let mut dest = File::create(to)?; // symlink planted between calls

// Good — atomic creation
let mut dest = OpenOptions::new()
    .write(true)
    .create_new(true)
    .open(to)?;
```

### UTF-8 Lossy on Binary Data
```rust
// Bad — silently corrupts non-UTF-8 bytes
print!("{}", String::from_utf8_lossy(data));

// Good — stay in bytes
io::stdout().write_all(data)?;
```

### mem::forget Causing Resource Leaks
```rust
// Bad — safe but leaks the resource (file handle, lock, etc.)
let guard = mutex.lock().unwrap();
std::mem::forget(guard); // lock never released

// Good — if you need to prevent Drop, document why
// SAFETY: ownership transferred to FFI; C code calls release()
std::mem::forget(handle);
```

### Missing #[must_use] on Validation/Builder Methods
```rust
// Bad — caller can silently ignore the result
impl Config {
    fn validate(&self) -> Result<(), Error> { ... }
}
config.validate(); // oops, Result dropped

// Good — compiler warns on unused Result
impl Config {
    #[must_use]
    fn validate(&self) -> Result<(), Error> { ... }
}
```

### Ambiguous Lifetime Elision
```rust
// Bad — which input does the output borrow from?
fn longest(a: &str, b: &str) -> &str {
    if a.len() > b.len() { a } else { b }
}

// Good — explicit lifetime ties output to both inputs
fn longest<'a>(a: &'a str, b: &'a str) -> &'a str {
    if a.len() > b.len() { a } else { b }
}
```

### Sentinel Values Instead of Option
```rust
// Bad — caller must remember to check for -1
fn find_index(haystack: &[u8], needle: u8) -> i32 {
    // returns -1 if not found
}

// Good — type system enforces the check
fn find_index(haystack: &[u8], needle: u8) -> Option<usize> {
    haystack.iter().position(|&b| b == needle)
}
```

## Testing

### Test Naming
```rust
// Bad — unclear what's being tested
#[test]
fn test_parse() {}

// Good — describe behavior
#[test]
fn parse_returns_error_on_empty_input() {}
#[test]
fn parse_extracts_version_from_header() {}
```

### Not Using #[should_panic] or Result Tests
```rust
// Bad — manually catching panics
#[test]
fn test_invalid_input() {
    let result = std::panic::catch_unwind(|| parse(""));
    assert!(result.is_err());
}

// Good
#[test]
#[should_panic(expected = "empty input")]
fn parse_panics_on_empty_input() {
    parse("");
}

// Also good — Result-returning test
#[test]
fn parse_rejects_empty_input() -> Result<(), Box<dyn std::error::Error>> {
    assert!(parse("").is_err());
    Ok(())
}
```

### Hardcoded File Paths in Tests
```rust
// Bad — breaks on CI or other machines
let path = "/Users/dev/testdata/fixture.json";

// Good — relative to manifest
let path = Path::new(env!("CARGO_MANIFEST_DIR")).join("testdata/fixture.json");
```

---

## Quick Reference

| Issue | Search Pattern | Severity |
|-------|---------------|----------|
| Unwrap in lib code | `rg '\.unwrap\(\)' --glob '!*test*'` | Critical |
| Unjustified unsafe | `rg 'unsafe' --glob '*.rs'` (check for SAFETY comment) | Critical |
| Unnecessary clone | `rg '\.clone\(\)'` | Minor |
| Mutex across await | `rg '\.lock\(\)' -A5` (check for .await) | Important |
| String as error | `rg 'Result<.*String>'` | Minor |
| Missing entry API | `rg 'contains_key.*insert'` | Minor |
| Unchecked indexing | `rg '\[.*\]' --glob '*.rs'` (check for user input) | Important |
| Box<dyn> overhead | `rg 'Box<dyn'` (check if generics work) | Minor |
| Debug on secrets | `rg 'derive.*Debug' -A5` (check for password/token fields) | Important |
| serde(default) on sensitive | `rg 'serde.default' -A3` (check field names) | Important |
| Silent truncation (as) | `rg ' as [iu](8|16|32)\b'` | Important |
| Unchecked arithmetic | `rg '\.checked_' --glob '*.rs'` (should exist near math) | Minor |
| Blocking in async | `rg 'std::fs\|std::net' --glob '*.rs'` (in async context) | Critical |
| std Mutex in async | `rg 'std::sync::Mutex' --glob '*.rs'` (check for .await) | Important |
| Rc<RefCell<T>> | `rg 'Rc<RefCell'` | Minor |
| TOCTOU on paths | `rg 'remove_file\|remove_dir' -A3` (check for create after) | Important |
| from_utf8_lossy | `rg 'from_utf8_lossy'` (check if data is truly text) | Minor |
| Init after construct | `rg 'fn new\(\)' -A5` (check for required init call) | Minor |
| mem::forget | `rg 'mem::forget'` | Important |
| Missing #[must_use] | `rg 'fn.*Result' --glob '*.rs'` (check pub methods) | Minor |
| Ambiguous lifetimes | `rg 'fn.*&.*&.*->' --glob '*.rs'` (multiple refs in, ref out) | Minor |
