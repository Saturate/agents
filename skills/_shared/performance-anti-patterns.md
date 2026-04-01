# Performance Anti-Patterns

Shared reference for catching performance issues during review and profiling.

## Backend

### Database
- **N+1 queries**: Loading a list, then querying for each item's relation. Use eager loading / joins / batch queries
- **Missing indexes**: Queries filtering/sorting on columns without indexes. Check EXPLAIN output
- **SELECT ***: Fetching all columns when only a few are needed. Select explicitly
- **Unbounded queries**: No LIMIT/pagination on list endpoints. Always paginate
- **Large transactions**: Holding locks for too long. Keep transactions short and focused
- **Connection exhaustion**: Not returning connections to pool. Use `using`/`defer`/connection pooling

### Application
- **Blocking I/O on async paths**: Sync file/network reads blocking the event loop or thread pool
- **No caching**: Repeated expensive operations with same inputs. Cache at the right level (in-memory, Redis, CDN)
- **Chatty APIs**: Multiple round trips where one batch request would work
- **Large payload responses**: Returning full objects when client needs a subset. Use projection/sparse fieldsets
- **Missing compression**: No gzip/brotli on API responses over 1KB
- **Memory leaks**: Event listeners not cleaned up, growing collections, unclosed streams

## Frontend

### Bundle & Loading
- **Large bundles**: No code splitting. Lazy load routes and heavy components
- **Unused dependencies**: Importing entire libraries for one function (lodash vs lodash-es, moment vs dayjs)
- **No tree shaking**: CommonJS imports preventing dead code elimination
- **Render-blocking resources**: CSS/JS in head without async/defer
- **Unoptimized images**: No responsive sizes, no modern formats (WebP/AVIF), no lazy loading

### Rendering
- **Unnecessary re-renders**: Missing memoization, passing new object/array references as props
- **Layout thrashing**: Reading and writing DOM geometry in a loop
- **Heavy main thread work**: Long tasks (>50ms) blocking input responsiveness
- **No virtualization**: Rendering thousands of DOM nodes. Virtualize long lists

## Core Web Vitals Targets

| Metric | Good | Description |
|--------|------|-------------|
| LCP (Largest Contentful Paint) | < 2.5s | Main content visible |
| INP (Interaction to Next Paint) | < 200ms | Responsiveness to input |
| CLS (Cumulative Layout Shift) | < 0.1 | Visual stability |
