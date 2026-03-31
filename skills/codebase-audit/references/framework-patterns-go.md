# Go Best Practices and Anti-Patterns

Reference for: Codebase Audit

Current best practices for Go projects. Focus on what actually matters for the audit.

## Table of Contents

1. [Version and Module Detection](#version-and-module-detection)
2. [Project Structure](#project-structure)
3. [Error Handling Anti-Patterns](#error-handling-anti-patterns)
4. [Concurrency Anti-Patterns](#concurrency-anti-patterns)
5. [Performance Anti-Patterns](#performance-anti-patterns)
6. [Security Issues](#security-issues)
7. [Database Anti-Patterns](#database-anti-patterns)
8. [Testing Issues](#testing-issues)
9. [Dependency and Build Issues](#dependency-and-build-issues)
10. [Observability](#observability)
11. [Recommended Checks](#recommended-checks)
12. [When to Flag as Critical](#when-to-flag-as-critical)
13. [When to Flag as Important](#when-to-flag-as-important)
14. [When to Flag as Minor](#when-to-flag-as-minor)

---

## Version and Module Detection

```bash
# Go version
grep "^go " go.mod

# Module path
head -1 go.mod

# Direct dependencies count
grep -c "^\t" go.sum | head -1
go list -m all 2>/dev/null | wc -l

# Check for vendoring
[ -d "vendor" ] && echo "Uses vendoring"

# Check for workspace mode (Go 1.18+)
[ -f "go.work" ] && echo "Uses workspaces"
```

## Project Structure

**Standard layout signals:**
```bash
# Check for common structure patterns
ls -d cmd/ internal/ pkg/ api/ 2>/dev/null

# Multiple binaries?
ls cmd/*/main.go 2>/dev/null

# Internal packages (good encapsulation)
ls -d internal/*/ 2>/dev/null | head -10
```

**Anti-patterns to flag:**
- Everything in root package with no structure
- `pkg/` containing internal-only code (should be `internal/`)
- Circular imports (build will catch these, but check for convoluted dependency graphs)
- `utils/` or `helpers/` packages — usually a sign of poor organization

```bash
# Check for catch-all packages
ls -d **/utils/ **/helpers/ **/common/ 2>/dev/null
```

## Error Handling Anti-Patterns

### 1. Discarded Errors (Critical)

The single most common Go bug. Every discarded error is a potential silent failure.

```bash
# Find discarded errors — high signal, review each one
grep -rn "_ :=" --include="*.go" . | grep -v "_test.go\|vendor/"

# Also check for unchecked error returns
grep -rn "\.Close()" --include="*.go" . | grep -v "defer.*Close\|err.*Close\|vendor/"
```

### 2. Unwrapped Errors

Errors without context are impossible to debug in production.

```bash
# Errors returned without wrapping
grep -rn "return err$" --include="*.go" . | grep -v "vendor/" | head -20

# Should use fmt.Errorf with %w
grep -rn 'fmt.Errorf.*%w' --include="*.go" . | wc -l
```

Compare the two counts. If bare `return err` vastly outnumbers `%w` wrapping, error handling needs work.

### 3. Error String Style

```bash
# Bad: capitalized error strings
grep -rn 'fmt.Errorf("[A-Z]' --include="*.go" . | grep -v "vendor/" | head -10

# Bad: trailing punctuation in errors
grep -rn 'fmt.Errorf(".*\."' --include="*.go" . | grep -v "vendor/" | head -10

# Bad: errors.New with capitals
grep -rn 'errors.New("[A-Z]' --include="*.go" . | grep -v "vendor/" | head -10
```

Go convention: error strings are lowercase, no trailing punctuation.

### 4. Panic in Non-Main Code

```bash
# panic() outside of main or init — each one needs justification
grep -rn "panic(" --include="*.go" . | grep -v "_test.go\|vendor/\|main.go"
```

Library code should return errors, never panic.

## Concurrency Anti-Patterns

### 1. Goroutine Leaks (Critical)

Goroutines without cancellation are memory leaks.

```bash
# Find goroutine spawns
grep -rn "go func\|go [a-zA-Z]" --include="*.go" . | grep -v "vendor/\|_test.go" | head -20

# Check if context is used for cancellation
grep -rn "context.Background\|context.TODO" --include="*.go" . | grep -v "vendor/"
```

For each `go func`, check:
- Is there a context for cancellation?
- Is there a `select` with `ctx.Done()`?
- Is the goroutine lifetime documented?

`context.TODO()` in production code means someone skipped proper context propagation.

### 2. Race Conditions

```bash
# Shared state modified in goroutines — look for writes without mutex
grep -rn "go func" --include="*.go" . | grep -v "vendor/" | head -20

# Check if sync primitives are used
grep -rn "sync.Mutex\|sync.RWMutex\|sync.Map\|atomic\." --include="*.go" . | wc -l
```

If goroutines exist but sync primitives are rare, likely has race conditions.

```bash
# Run the race detector (if tests exist)
go test -race ./... 2>&1 | grep -c "DATA RACE" || echo "0 races detected"
```

### 3. Unbounded Goroutine Spawning

```bash
# Goroutines spawned in loops without limits
grep -B2 "go func\|go [a-zA-Z]" --include="*.go" . | grep "for\|range" | head -10
```

Should use worker pools or semaphores to limit concurrency.

### 4. Channel Misuse

```bash
# Unbuffered channels that might block
grep -rn "make(chan " --include="*.go" . | grep -v "vendor/"

# Channels never closed (potential goroutine leaks)
grep -rn "make(chan " --include="*.go" . | grep -v "vendor/" | head -10
# Then check if corresponding close() exists
```

## Performance Anti-Patterns

### 1. String Concatenation in Loops

```bash
grep -rn "+= .*string\|+ .*string" --include="*.go" . | grep -v "vendor/" | head -10
```

Should use `strings.Builder` for building strings in loops.

### 2. Missing Slice Preallocation

```bash
# append in loops without make(..., 0, len)
grep -B5 "append(" --include="*.go" . | grep "for\|range" | head -10
```

### 3. Large Structs Passed by Value

```bash
# Functions receiving large struct types by value
# (manual review — look for types with many fields passed without pointer)
grep -rn "func.*) [A-Z]" --include="*.go" . | grep -v "vendor/\|*\|error\|string\|int\|bool" | head -10
```

### 4. Missing Connection Pooling

```bash
# HTTP clients created per-request instead of reused
grep -rn "http.Get\|http.Post\|&http.Client{}" --include="*.go" . | grep -v "vendor/"
```

`http.DefaultClient` or a package-level `*http.Client` should be reused.

### 5. JSON Handling

```bash
# json.Marshal/Unmarshal on hot paths (consider jsoniter or sonic for performance)
grep -rn "json.Marshal\|json.Unmarshal\|json.NewDecoder\|json.NewEncoder" --include="*.go" . | wc -l

# Missing struct tags
grep -rn "type.*struct" --include="*.go" . | head -10
# Then check if JSON fields have tags
```

## Security Issues

### 1. SQL Injection

```bash
# String formatting in SQL queries
grep -rn 'fmt.Sprintf.*SELECT\|fmt.Sprintf.*INSERT\|fmt.Sprintf.*UPDATE\|fmt.Sprintf.*DELETE' --include="*.go" . | grep -v "vendor/"
grep -rn 'fmt.Sprintf.*FROM\|fmt.Sprintf.*WHERE' --include="*.go" . | grep -v "vendor/"

# String concatenation in queries
grep -rn '"SELECT.*" +\|"INSERT.*" +\|"UPDATE.*" +' --include="*.go" . | grep -v "vendor/"
```

### 2. Command Injection

```bash
# User input in exec commands
grep -rn "exec.Command\|os.StartProcess" --include="*.go" . | grep -v "vendor/"
```

Check if arguments are user-controlled.

### 3. SSRF via Unchecked URLs

```bash
# HTTP requests with user-provided URLs
grep -rn "http.Get\|http.Post\|http.NewRequest" --include="*.go" . | grep -v "vendor/"
```

Check if URLs come from user input without validation.

### 4. Hardcoded Secrets

```bash
grep -rn 'password.*=.*"\|secret.*=.*"\|apiKey.*=.*"\|token.*=.*"' --include="*.go" . | grep -v "vendor/\|_test.go"
```

### 5. Insecure TLS

```bash
# Skipping TLS verification
grep -rn "InsecureSkipVerify.*true" --include="*.go" . | grep -v "vendor/"

# Minimum TLS version not set
grep -rn "tls.Config" --include="*.go" . | grep -v "MinVersion\|vendor/"
```

### 6. Missing Input Validation

```bash
# HTTP handlers reading request body without validation
grep -rn "json.NewDecoder.*Body\|io.ReadAll.*Body" --include="*.go" . | grep -v "vendor/"
```

Check if request size is limited and input is validated after parsing.

## Database Anti-Patterns

### 1. Leaked Connections

```bash
# Query without defer rows.Close()
grep -rn "\.Query\|\.QueryRow\|\.QueryContext" --include="*.go" . | grep -v "vendor/" | head -20
# Check each for corresponding defer rows.Close()
```

### 2. Missing Transaction Handling

```bash
# Check if transactions are used for multi-step operations
grep -rn "\.Begin\|\.BeginTx" --include="*.go" . | wc -l

# Transactions without rollback
grep -A10 "\.Begin" --include="*.go" . | grep -c "Rollback"
```

### 3. N+1 Queries

```bash
# Database calls inside loops
grep -B3 "\.Query\|\.QueryRow\|\.Exec" --include="*.go" . | grep "for\|range" | head -10
```

### 4. Missing Migrations

```bash
# Check for migration framework
ls -d migrations/ db/migrations/ **/migrations/ 2>/dev/null
grep -r "golang-migrate\|goose\|atlas" go.mod
```

No migration framework in a project with database access is a red flag.

## Testing Issues

### 1. Test Coverage

```bash
# Run coverage
go test -cover ./... 2>/dev/null | grep -v "vendor/"

# Coverage by package
go test -coverprofile=coverage.out ./... 2>/dev/null && go tool cover -func=coverage.out | tail -1
```

### 2. Missing Tests

```bash
# Packages without any test files
for dir in $(find . -name "*.go" -not -path "*/vendor/*" -not -name "*_test.go" -exec dirname {} \; | sort -u); do
  [ -z "$(find "$dir" -name "*_test.go" -maxdepth 1 2>/dev/null)" ] && echo "No tests: $dir"
done
```

### 3. Test Quality

```bash
# Tests that don't assert anything
grep -rn "func Test" --include="*_test.go" . | wc -l
grep -rn "t.Error\|t.Fatal\|t.Assert\|assert\.\|require\." --include="*_test.go" . | wc -l

# t.Helper() usage in test helpers
grep -rn "func [a-z].*testing.T" --include="*_test.go" . | head -10
# Check if these have t.Helper()
```

### 4. Race Detector

```bash
# Check if CI runs race detector
grep -rn "race" Makefile .github/ .gitlab-ci.yml 2>/dev/null
```

If no race detector in CI, flag as important.

## Dependency and Build Issues

### 1. Outdated Dependencies

```bash
# Check for available updates
go list -u -m all 2>/dev/null | grep "\[" | head -20
```

### 2. Vulnerability Scanning

```bash
# Go's built-in vuln checker
govulncheck ./... 2>/dev/null

# Or use nancy for go.sum
go list -json -m all 2>/dev/null | nancy sleuth 2>/dev/null
```

### 3. Build and Vet

```bash
# Does it build?
go build ./... 2>&1 | head -20

# Vet issues
go vet ./... 2>&1 | head -20

# Static analysis (if available)
staticcheck ./... 2>/dev/null | head -20
gocritic check ./... 2>/dev/null | head -20
```

### 4. Missing Linter Configuration

```bash
# Check for golangci-lint config
ls .golangci.yml .golangci.yaml .golangci.toml 2>/dev/null
```

No linter config means no consistent code quality enforcement.

## Observability

```bash
# Structured logging
grep -rn "log.Print\|log.Fatal\|log.Panic\|fmt.Print" --include="*.go" . | grep -v "vendor/\|_test.go" | wc -l
grep -rn "slog\.\|zap\.\|zerolog\.\|logrus\." --include="*.go" . | grep -v "vendor/" | wc -l

# Health check endpoint
grep -rn "health\|healthz\|readyz\|livez" --include="*.go" . | grep -v "vendor/"

# Metrics (Prometheus, OpenTelemetry)
grep -r "prometheus\|otel\|opentelemetry" go.mod

# Tracing
grep -r "trace\." --include="*.go" . | grep -v "vendor/\|_test.go\|stacktrace\|backtrace" | head -5
```

If `log.Print` count vastly exceeds structured logging count, logging needs an upgrade. `fmt.Print` in production code is almost always wrong.

## Recommended Checks

```bash
# Quick health check
echo "=== Build ===" && go build ./... 2>&1 | tail -5
echo "=== Vet ===" && go vet ./... 2>&1 | tail -5
echo "=== Tests ===" && go test -short ./... 2>&1 | tail -5
echo "=== Race ===" && go test -race -short ./... 2>&1 | tail -5

# Module hygiene
go mod tidy -diff 2>/dev/null || echo "Run go mod tidy"
go mod verify 2>/dev/null

# Dead code
grep -rn "func [A-Z]" --include="*.go" . | grep -v "vendor/\|_test.go\|main.go" | head -20
# Cross-reference with usage to find unused exports
```

## When to Flag as Critical

- Discarded errors in data paths or network handling
- SQL injection via string formatting
- Hardcoded secrets
- InsecureSkipVerify in production
- Goroutine leaks without cancellation
- Data races (confirmed by `go test -race`)
- Panics in library code
- Command injection via exec

## When to Flag as Important

- Bare `return err` without wrapping (most of the codebase)
- `context.TODO()` in production code
- No test coverage for critical paths
- No race detector in CI
- Missing linter configuration
- No structured logging
- No health check endpoint
- Missing database migrations framework
- Unbounded goroutine spawning
- Connection leaks (missing `defer rows.Close()`)

## When to Flag as Minor

- Error string capitalization/punctuation
- Missing slice preallocation
- `http.DefaultClient` usage (acceptable for simple cases)
- Missing `t.Helper()` in test helpers
- Import grouping inconsistencies
- Getter naming (`GetFoo` instead of `Foo`)
