---
name: performance-profiling
description: Guides active performance investigation with measure-identify-fix-measure cycle for both frontend and backend. Triggers chrome-devtools for frontend profiling. Use when profiling performance, investigating slow code, optimizing speed, performance issues, slow page, slow API, latency problems, or when something feels sluggish.
allowed-tools: Read Grep Glob Bash
metadata:
  author: Saturate
  version: "1.0"
---

# Performance Profiling

Don't optimize based on vibes. Measure, find the bottleneck, fix it, measure again.

## Progress Checklist

- [ ] Identify what's slow (user report, monitoring, reproduction)
- [ ] Measure baseline with numbers
- [ ] Identify the bottleneck
- [ ] Fix the bottleneck
- [ ] Measure again to confirm improvement
- [ ] Guard against regression

## Step 0: What's Actually Slow?

Get specific before profiling:

- Which endpoint / page / operation?
- How slow? (2 seconds? 30 seconds? timeout?)
- For whom? (all users, specific data, specific browser?)
- Since when? (always, since a deploy, since data grew?)

If monitoring exists (APM, Application Insights, DataDog), check there first for actual numbers.

## Frontend Path

Trigger `chrome-devtools` skill for browser-based profiling:

### Lighthouse Audit
Run a Lighthouse audit for overall scores (Performance, Accessibility, Best Practices, SEO).

### Core Web Vitals

| Metric | Good | What to check |
|--------|------|--------------|
| LCP < 2.5s | Largest content paint | Large images, render-blocking resources, slow server response |
| INP < 200ms | Interaction to next paint | Heavy event handlers, long main thread tasks, layout thrashing |
| CLS < 0.1 | Layout shift | Images without dimensions, dynamic content insertion, font loading |

### Bundle Analysis
```bash
# Check bundle size
npx vite-bundle-visualizer 2>/dev/null
npx webpack-bundle-analyzer 2>/dev/null
npx next build 2>/dev/null  # Next.js shows bundle sizes in build output
```

### Common Frontend Fixes
- Code split routes (lazy load)
- Optimize images (size, format, lazy loading)
- Remove unused dependencies
- Defer non-critical JS/CSS
- Virtualize long lists
- Memoize expensive computations

## Backend Path

### Identify the Layer

```bash
# If you have access to request tracing
# Check which part of the request takes the longest:
# - Database queries
# - External API calls
# - Application logic
# - Serialization
```

### Database Profiling

```sql
-- PostgreSQL: check slow queries
EXPLAIN ANALYZE SELECT ...;

-- Check for missing indexes
-- Look for Seq Scan on large tables in the EXPLAIN output
```

```csharp
// .NET: EF Core query logging
// Check for N+1 patterns: multiple queries where one join would work
// Check for missing .AsNoTracking() on read-only queries
```

```go
// Go: check for sequential DB calls that could be batched
// Profile with pprof: go tool pprof http://localhost:6060/debug/pprof/profile
```

### Common Backend Fixes
- Add missing database indexes
- Fix N+1 queries (eager loading, joins, batch queries)
- Add caching at the right level (in-memory, Redis, CDN)
- Enable response compression (gzip/brotli)
- Pagination on all list endpoints
- Connection pooling for databases and HTTP clients
- Move expensive work to background jobs

## Measure Again

After making a fix:

1. Run the same measurement as the baseline
2. Compare numbers: did it actually improve?
3. How much? (percentage, absolute time)
4. Any regressions in other areas?

If the improvement isn't significant, the bottleneck might be elsewhere. Go back to identification.

## Guard Against Regression

- Add performance budgets to CI (bundle size limits, Lighthouse score thresholds)
- Monitor key metrics over time (response times, Core Web Vitals)
- For critical paths, add performance assertions to tests

See `../_shared/performance-anti-patterns.md` for a comprehensive list of patterns to watch for during code review.
