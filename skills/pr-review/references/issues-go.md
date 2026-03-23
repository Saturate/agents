# Go Issues

Reference for: PR Review

Load when diff contains `*.go`, `go.mod`, `go.sum` files.

## Table of Contents

1. [Error Handling](#error-handling)
2. [Concurrency](#concurrency)
3. [Naming & Style](#naming--style)
4. [Slices, Maps & Interfaces](#slices-maps--interfaces)
5. [Performance](#performance)
6. [Security](#security)
7. [Testing](#testing)
8. [Quick Reference](#quick-reference)

---

## Error Handling

### Silently Discarded Errors
```go
// Bad — error disappears
file, _ := os.Open(path)

// Good — handle or log
file, err := os.Open(path)
if err != nil {
    return fmt.Errorf("opening config: %w", err)
}
```

### Missing Error Wrapping
```go
// Bad — loses context up the call stack
if err != nil {
    return err
}

// Good — wrap with %w for context and unwrapping
if err != nil {
    return fmt.Errorf("refreshing baselines: %w", err)
}
```

### Error String Style
```go
// Bad — capitalized, trailing punctuation
fmt.Errorf("Failed to open file.")

// Good — lowercase, no trailing punctuation
fmt.Errorf("opening file: %w", err)
```

### Panic in Library Code
```go
// Bad — crashes the caller
func ParseConfig(data []byte) Config {
    if len(data) == 0 {
        panic("empty config")
    }
}

// Good — return an error
func ParseConfig(data []byte) (Config, error) {
    if len(data) == 0 {
        return Config{}, errors.New("empty config data")
    }
}
```

### Error Flow Indentation
```go
// Bad — happy path buried inside else
if err == nil {
    // long happy path
    // ...
} else {
    return err
}

// Good — handle errors first, keep happy path at minimal indentation
if err != nil {
    return fmt.Errorf("fetching user: %w", err)
}
// happy path continues here
```

## Concurrency

### Goroutine Leak (No Stop Mechanism)
```go
// Bad — goroutine runs forever, no way to stop it
func StartWorker() {
    go func() {
        for {
            process()
            time.Sleep(time.Second)
        }
    }()
}

// Good — context-based cancellation
func StartWorker(ctx context.Context) {
    go func() {
        ticker := time.NewTicker(time.Second)
        defer ticker.Stop()
        for {
            select {
            case <-ctx.Done():
                return
            case <-ticker.C:
                process()
            }
        }
    }()
}
```

### Shared State Without Synchronization
```go
// Bad — data race
var count int

func increment() {
    count++ // concurrent access
}

// Good — use mutex or atomic
var (
    mu    sync.Mutex
    count int
)

func increment() {
    mu.Lock()
    defer mu.Unlock()
    count++
}
```

### Unbounded Goroutine Spawning
```go
// Bad — spawns thousands of goroutines at once
for _, item := range items {
    go process(item)
}

// Good — use a worker pool or semaphore
sem := make(chan struct{}, 10) // limit concurrency
var wg sync.WaitGroup
for _, item := range items {
    wg.Add(1)
    sem <- struct{}{}
    go func(item Item) {
        defer wg.Done()
        defer func() { <-sem }()
        process(item)
    }(item)
}
wg.Wait()
```

### Missing defer rows.Close()
```go
// Bad — leaks database connection
rows, err := db.Query("SELECT ...")
if err != nil {
    return err
}
// forgot to close rows

// Good
rows, err := db.Query("SELECT ...")
if err != nil {
    return err
}
defer rows.Close()
```

## Naming & Style

### Getter Prefix
```go
// Bad — Go doesn't use Get prefix on getters
func (u *User) GetName() string { return u.name }

// Good
func (u *User) Name() string { return u.name }
func (u *User) SetName(n string) { u.name = n } // setters keep Set
```

### Acronym Casing
```go
// Bad
type ApiUrl string
type SessionId string
type HttpClient struct{}

// Good — acronyms are all-caps
type APIURL string
type SessionID string
type HTTPClient struct{}
```

### Receiver Names
```go
// Bad
func (self *Server) Start() {}
func (this *Server) Start() {}
func (server *Server) Start() {}

// Good — 1-2 letter abbreviation of type
func (s *Server) Start() {}
```

### Import Grouping
```go
// Good — stdlib, external, internal separated by blank lines
import (
    "context"
    "fmt"

    "github.com/redis/go-redis/v9"

    "myproject/internal/store"
)
```

## Slices, Maps & Interfaces

### Nil vs Empty Slice
```go
// Bad — unnecessary allocation when nil is fine
s := []string{}

// Good — nil slice works with append, len, range
var s []string

// Exception: use empty literal when non-nil matters (JSON encoding)
// json.Marshal([]string{})  → []
// json.Marshal([]string(nil)) → null
```

### Speculative Interfaces
```go
// Bad — interface defined alongside the only implementation
type UserStore interface {
    GetUser(id string) (*User, error)
}

type userStore struct{ db *sql.DB }

// Good — define interfaces where consumed, not implemented
// In the package that USES the store:
type UserFetcher interface {
    GetUser(id string) (*User, error)
}

func NewHandler(users UserFetcher) *Handler { ... }
```

## Performance

### String Concatenation in Loops
```go
// Bad — O(n^2) allocations
var result string
for _, s := range items {
    result += s
}

// Good
var b strings.Builder
for _, s := range items {
    b.WriteString(s)
}
result := b.String()
```

### Not Preallocating Slices
```go
// Bad — multiple reallocations as slice grows
var result []Item
for _, raw := range input {
    result = append(result, transform(raw))
}

// Good — preallocate when length is known
result := make([]Item, 0, len(input))
for _, raw := range input {
    result = append(result, transform(raw))
}
```

### Passing Large Structs by Value
```go
// Bad — copies entire struct on each call
func Process(config LargeConfig) { ... }

// Good — pass pointer for large structs
func Process(config *LargeConfig) { ... }
```

## Security

### SQL Injection
```go
// Bad — string interpolation in query
query := fmt.Sprintf("SELECT * FROM users WHERE id = '%s'", userID)
db.Query(query)

// Good — parameterized query
db.Query("SELECT * FROM users WHERE id = ?", userID)
```

### Unchecked HTTP Redirect
```go
// Bad — follows arbitrary redirects (SSRF risk)
resp, err := http.Get(userProvidedURL)

// Good — limit redirects
client := &http.Client{
    CheckRedirect: func(req *http.Request, via []*http.Request) error {
        if len(via) >= 3 {
            return errors.New("too many redirects")
        }
        return nil
    },
}
```

### Hardcoded Credentials
```go
// Bad
const apiKey = "sk_live_abc123"

// Good
apiKey := os.Getenv("API_KEY")
```

## Testing

### Test Naming
```go
// Bad — unclear what's being tested
func TestProcess(t *testing.T) {}

// Good — TypeName_Behavior
func TestParser_EmptyInput(t *testing.T) {}
func TestStore_ReturnsErrOnTimeout(t *testing.T) {}
```

### Missing t.Helper() in Test Helpers
```go
// Bad — error points to helper, not caller
func assertOK(t *testing.T, err error) {
    if err != nil {
        t.Fatal(err) // line number points here, not the test
    }
}

// Good
func assertOK(t *testing.T, err error) {
    t.Helper()
    if err != nil {
        t.Fatal(err) // line number points to the calling test
    }
}
```

### Not Using t.Parallel()
```go
// Consider t.Parallel() for independent tests to speed up the suite
func TestFetch(t *testing.T) {
    t.Parallel()
    // ...
}
```

---

## Quick Reference

| Issue | Search Pattern | Severity |
|-------|---------------|----------|
| Discarded error | `grep -rn "_ :=\|_ ="` | Critical |
| Panic in non-main | `grep -rn "panic("` | Important |
| Async void getter | `grep -rn "func.*Get[A-Z]"` | Minor |
| Missing rows.Close | `grep -rn "db.Query" \| grep -v "defer"` | Important |
| Race condition | `grep -rn "go func"` (check for shared state) | Important |
| String concat loop | `grep -rn "+= .*string"` | Minor |
