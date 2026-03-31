---
name: api-design
description: Designs APIs with contract-first, consumer-driven approach including validation at boundaries, consistent error responses, and security focus. Generates types from OpenAPI/Swagger. Use when designing an API, creating endpoints, API architecture, REST design, building an API, defining contracts, new service, or when starting API work.
allowed-tools: Read Grep Glob Bash
metadata:
  author: Saturate
  version: "1.0"
---

# API Design

Build interfaces that are hard to misuse. Design from the consumer's perspective.

## Progress Checklist

- [ ] Determine context (internal vs public)
- [ ] Define contract first (OpenAPI/types)
- [ ] Design from consumer perspective
- [ ] Validate at boundaries
- [ ] Consistent error responses
- [ ] Sane defaults
- [ ] Generate types from spec

## Step 0: Context Check

This changes everything about the design:

| Question | Internal API | Public API |
|----------|-------------|-----------|
| Who consumes it? | Your team, known services | Unknown third parties |
| Breaking changes? | Coordinate and deploy together | Version, deprecate, migrate |
| Auth complexity? | Service-to-service tokens | OAuth, API keys, rate limiting |
| Documentation? | Enough for the team | Comprehensive, with examples |
| Backward compat? | Just change it | Required, additive only |

Don't apply public-API rigor to an internal endpoint you own both sides of.

## Step 1: Contract First

Define the interface before writing implementation:

- Write an OpenAPI/Swagger spec, or
- Define TypeScript types for request/response, or
- Define the protobuf/gRPC schema

This forces you to think about the shape of data before getting lost in business logic.

## Step 2: Consumer-Driven Design

Write the calling code first (or imagine writing it). Ask:

- Is this intuitive to call?
- Are there too many required parameters?
- Are defaults sane? (Do I have to pass 10 options to do the common thing?)
- Can I understand what this endpoint does from its name and parameters?

If calling the API is awkward, fix the API. Don't make consumers work around bad design.

### Sane Defaults

Every parameter should have a sensible default where possible:
- Pagination: default page size (e.g., 20), max page size (e.g., 100)
- Sorting: default sort order that makes sense for the use case
- Filtering: no filter = return all (within pagination)
- Timeouts: reasonable defaults, don't require the caller to set them

## Step 3: Validate at Boundaries

All input validation happens at the API layer. Not in services, not in repositories.

- Use schema validation (zod, FluentValidation, go-playground/validator)
- Reject unexpected fields explicitly
- Validate types, ranges, formats, and required fields
- Return clear validation error messages with field names

See `../_shared/security-checklist.md` for security-specific validation patterns.

## Step 4: Consistent Error Responses

Every error should follow the same format. Never leak internals.

See `references/api-patterns.md` for error response formats and examples.

Key rules:
- Same structure for all errors (even 500s)
- Include a machine-readable error code
- Include a human-readable message
- Never expose stack traces, SQL, file paths, or internal IDs in production
- Log the details server-side, return the summary to the client

## Step 5: Standard Patterns

- **Pagination** on every list endpoint. No exceptions. Cursor-based or offset-based.
- **Rate limiting** on auth endpoints and any endpoint that triggers expensive operations
- **Idempotency** for operations that change state (use idempotency keys for payment, creation endpoints)
- **PATCH for partial updates**, PUT for full replacement (or just use PATCH)

See `references/api-patterns.md` for detailed patterns.

## Step 6: Generate Types

Don't hand-write API types on the client side:

| Stack | Tool |
|-------|------|
| TypeScript | openapi-typescript, orval, openapi-generator |
| .NET | NSwag, Kiota |
| Go | oapi-codegen |

The spec is the source of truth. Generated types stay in sync automatically.
