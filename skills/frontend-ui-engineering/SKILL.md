---
name: frontend-ui-engineering
description: Guides frontend UI development with component hierarchy, separation of concerns, accessibility as requirement, and performance awareness. Framework-agnostic, detects stack from project. Triggers chrome-devtools for verification. Use when building UI, frontend development, creating components, UI engineering, component architecture, building pages, or when working on frontend code.
allowed-tools: Read Grep Glob Bash
metadata:
  author: Saturate
  version: "1.0"
---

# Frontend UI Engineering

Build components that are reusable, accessible, and performant. Don't make one big file with everything in it.

## Progress Checklist

- [ ] Detect framework and existing patterns
- [ ] Design component hierarchy
- [ ] Separate data fetching from presentation
- [ ] Handle all states (loading, error, empty)
- [ ] Ensure accessibility
- [ ] Check performance impact
- [ ] Verify with chrome-devtools (if URL available)

## Step 0: Detect Framework

```bash
# Check what we're working with
cat package.json 2>/dev/null | grep -E "react|vue|svelte|angular|next|nuxt|astro"
ls src/components/ app/components/ components/ 2>/dev/null | head -10
```

Match the project's existing component patterns, naming conventions, and file organization.

## Step 1: Component Hierarchy

Build at the right level of abstraction. Small, reusable pieces compose into larger ones:

- **Tokens / Primitives**: Colors, spacing, typography, icons. Design system foundation.
- **Base Components**: Buttons, inputs, cards, modals. Generic, no business logic.
- **Composite Components**: Forms, data tables, navigation. Combine base components.
- **Features / Views**: Full sections with business logic, data fetching, routing.
- **Pages / Layouts**: Top-level composition, page structure.

Rules:
- Each component does one thing
- If a component file is > 200 lines, it probably does too much
- Reuse existing components before creating new ones
- Don't create abstractions for things used only once

## Step 2: Separate Concerns

Data fetching and presentation are different jobs:

- **Container / Smart**: Fetches data, manages state, handles events
- **Presentation / Dumb**: Receives props, renders UI, fires callbacks

This makes components testable (presentation) and keeps data logic centralized (container).

Framework-specific patterns:
- React: Custom hooks for data, components for rendering
- Vue: Composables for data, components for rendering
- Next.js/Nuxt: Server components for data, client components for interactivity

## Step 3: Handle All States

Every component that deals with data needs these states:

| State | What to show |
|-------|-------------|
| **Loading** | Skeleton, spinner, or placeholder. Not a blank screen. |
| **Error** | Clear message, retry action if possible. Not a crash. |
| **Empty** | Helpful message, maybe a CTA. Not "No results." with no context. |
| **Success** | The actual content. |
| **Partial** | Some data loaded, some still loading. Progressive rendering. |

## Step 4: Accessibility

This is a requirement, not a feature. Client work may have legal requirements (WCAG 2.1 AA).

Non-negotiables:
- All interactive elements reachable by keyboard (Tab, Enter, Escape, Arrow keys)
- Semantic HTML elements (`button` not `div onClick`, `nav`, `main`, `article`)
- Form inputs have associated labels
- Images have alt text (or `alt=""` for decorative)
- Color contrast meets WCAG AA (4.5:1 for normal text, 3:1 for large text)
- Focus indicators visible
- Screen reader compatible (test with VoiceOver: Cmd+F5 on macOS)

For detailed patterns, see `../codebase-audit/references/accessibility-checklist.md`.

## Step 5: Performance

Be conscious of what you ship:

- **Lazy load** routes and heavy components (code splitting)
- **Optimize images**: correct size, modern format (WebP/AVIF), lazy loading
- **Avoid unnecessary re-renders**: memoize expensive computations, stable references for callbacks/objects in props
- **Monitor bundle size**: importing a whole library for one function is expensive
- **Virtualize long lists**: don't render 1000 DOM nodes when 20 are visible

## Step 6: Verify

When a URL is available, trigger the `chrome-devtools` skill to verify:

- Console is clean (no errors, no warnings)
- Network requests are correct
- Visual output matches expectations (screenshot)
- Accessibility tree is correct
- Lighthouse scores are acceptable
- No layout shifts or jank
