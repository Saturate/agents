# API Patterns Reference

## Error Response Format

Use a consistent structure for all errors:

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "The request contains invalid fields",
    "details": [
      {
        "field": "email",
        "message": "Must be a valid email address"
      }
    ]
  }
}
```

### HTTP Status Codes

| Code | When | Example |
|------|------|---------|
| 200 | Success | GET, PATCH responses |
| 201 | Created | POST that creates a resource |
| 204 | No Content | DELETE, or updates with no response body |
| 400 | Bad Request | Validation failed, malformed input |
| 401 | Unauthorized | Missing or invalid auth credentials |
| 403 | Forbidden | Authenticated but not authorized |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | Duplicate creation, version conflict |
| 422 | Unprocessable | Valid syntax but semantically wrong |
| 429 | Too Many Requests | Rate limited |
| 500 | Internal Error | Unexpected server failure |

### What NOT to include in error responses

- Stack traces
- Database column names or table names
- File system paths
- Internal service names
- SQL queries
- Framework-specific error objects

Log these server-side with a correlation ID. Return only the correlation ID to the client for support reference.

## Pagination

### Offset-Based

Simple, good for most cases. Can have issues with large datasets and concurrent writes.

```
GET /api/users?page=2&pageSize=20

{
  "data": [...],
  "pagination": {
    "page": 2,
    "pageSize": 20,
    "totalCount": 153,
    "totalPages": 8
  }
}
```

### Cursor-Based

Better for large datasets, infinite scroll, and real-time data. More complex to implement.

```
GET /api/events?after=eyJpZCI6MTIzfQ&limit=20

{
  "data": [...],
  "pagination": {
    "hasMore": true,
    "nextCursor": "eyJpZCI6MTQzfQ"
  }
}
```

Choose based on use case:
- Admin tables with page numbers? Offset-based.
- Feeds, timelines, large datasets? Cursor-based.

## Filtering & Sorting

```
GET /api/users?status=active&role=admin&sort=-createdAt,name
```

- Prefix `-` for descending sort
- Allow multiple sort fields
- Validate all filter and sort fields against allowed list (don't allow sorting by arbitrary columns)

## Versioning Strategies

Only version when you have external consumers you can't coordinate with.

| Strategy | Example | When |
|----------|---------|------|
| URL path | `/api/v2/users` | Simple, explicit, easy to route |
| Header | `Accept: application/vnd.api.v2+json` | Cleaner URLs, harder to test |
| Query param | `/api/users?version=2` | Easy to test, can feel hacky |

For internal APIs: don't version. Just change it and deploy both sides together.

## Rate Limiting

Return rate limit info in headers:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1620000000
Retry-After: 30
```

Apply rate limits to:
- Authentication endpoints (prevent brute force)
- Expensive operations (reports, exports, bulk operations)
- Public endpoints (prevent abuse)
