# Security Checklist

Shared reference for security-aware reviews across all skill levels.

## Input Validation

- All user input validated at the boundary (controller/handler level, not deeper)
- Schema validation with strict types (zod, valibot, FluentValidation, go-playground/validator)
- Reject unexpected fields, don't silently ignore them
- File uploads: validate type, size, content (not just extension)
- No raw SQL concatenation. Parameterized queries only
- No raw HTML interpolation. Sanitize or use framework escaping

## Authentication & Authorization

- Auth on every protected endpoint, no exceptions
- Check authorization (not just authentication) - "is this user allowed to do THIS action on THIS resource?"
- IDOR checks: can user A access user B's data by changing an ID in the URL?
- JWT: validate signature, expiry, issuer, audience. Don't just decode
- Session tokens: HttpOnly, Secure, SameSite flags
- Password storage: bcrypt/argon2, never plain text, never MD5/SHA

## Sensitive Data

- No secrets in source code (API keys, connection strings, passwords)
- No secrets in Docker images or build artifacts
- No secrets in client-side code or bundles
- Error responses don't leak internals (stack traces, DB column names, file paths)
- Logs don't contain passwords, tokens, PII, or full credit card numbers
- .env files gitignored, .env.example committed without real values

## Headers & Transport

- HTTPS enforced (HSTS header)
- CSP header configured (prevents XSS, data injection)
- X-Frame-Options or frame-ancestors CSP (prevents clickjacking)
- X-Content-Type-Options: nosniff
- CORS configured explicitly, not `*` on authenticated endpoints
- Rate limiting on auth endpoints and sensitive operations

## Dependencies

- No known critical/high vulnerabilities (`npm audit`, `dotnet list package --vulnerable`, `govulncheck`)
- No abandoned packages (last publish > 2 years, no maintainer activity)
- Lock files committed (package-lock.json, go.sum, packages.lock.json)
- No dependency confusion risk (private package names that could be squatted)

## Common Injection Patterns

| Pattern | Risk | Fix |
|---------|------|-----|
| String concat in SQL | SQL injection | Parameterized queries |
| `innerHTML` / `v-html` / `dangerouslySetInnerHTML` | XSS | Text content or sanitize |
| `eval()`, `new Function()`, `child_process.exec()` with user input | Code injection | Avoid or sanitize strictly |
| Template literals in shell commands | Command injection | Use `execFile` with args array |
| `redirect(req.query.url)` | Open redirect | Allowlist redirect targets |
| `path.join(base, userInput)` without validation | Path traversal | Validate, reject `..` |
| Deserializing untrusted data (pickle, BinaryFormatter) | RCE | Use safe serializers (JSON) |
