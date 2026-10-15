# Next.js Issues

Reference for: PR Review

Load when `next` is in the dependencies of the nearest `package.json` to any changed file (in monorepos that is usually `apps/*/package.json`, not the root).

## Table of Contents

1. [Navigation](#navigation)
2. [Quick Reference](#quick-reference)

---

## Navigation

### Raw Anchor Instead of Link

Internal navigation must use `<Link>` from `next/link`, not raw `<a>` tags. A plain `<a>` causes a full page reload, killing client-side navigation and losing client state.

```tsx
// Bad: full page reload
<a href="/dashboard">Go to dashboard</a>

// Good: client-side navigation
import Link from 'next/link'
<Link href="/dashboard">Go to dashboard</Link>
```

When to flag:
- `<a href="/...">` or `<a href={someInternalPath}>` in any component
- Dynamic routes like `<a href={`/users/${id}`}>`

When it's fine as `<a>`:
- External links (`https://...`, `mailto:`, `tel:`)
- Anchor links (`#section`)
- API routes and file downloads (`/api/export`, `/files/report.pdf`), which need a real navigation
- Links that intentionally need a full reload (rare, should have a comment explaining why)

---

## Quick Reference

| Issue | Search Pattern | Severity |
|-------|---------------|----------|
| Raw anchor for internal route | `rg '<a\b[^>]*href=("|\{\x60?)/' --glob '*.tsx' --glob '*.jsx'` then check for API routes and files | Important |
