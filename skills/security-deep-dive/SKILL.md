---
name: security-deep-dive
description: Performs red team security analysis with threat modeling, attack surface mapping, auth flow analysis, and dependency chain audits. Goes beyond checklists to think like an attacker. Use when doing security audit, penetration testing, threat modeling, security review, attack surface analysis, red team assessment, or when codebase-audit flags serious security concerns.
allowed-tools: Read Grep Glob Bash WebSearch
metadata:
  author: Saturate
  version: "1.0"
---

# Security Deep Dive

Think like an attacker. What would you try to break?

## Progress Checklist

- [ ] Define scope and threat model
- [ ] Map the attack surface
- [ ] Analyze auth flows
- [ ] Audit dependency chain
- [ ] Review infrastructure config
- [ ] Attempt exploitation paths
- [ ] Report findings with severity

## Step 0: Scope and Threat Model

Before diving in, understand what we're protecting:

- What data is sensitive? (PII, credentials, financial, health)
- Who are the threat actors? (anonymous users, authenticated users, insiders, automated attacks)
- What's the impact of a breach? (data leak, financial loss, reputation, compliance violation)
- What's already in place? (auth, encryption, monitoring, WAF)

## Step 1: Attack Surface Mapping

List every entry point:

```bash
# Find API endpoints
grep -rn "router\.\|app\.\(get\|post\|put\|delete\|patch\)" --include="*.ts" --include="*.js" --include="*.go"
grep -rn "\[Http\(Get\|Post\|Put\|Delete\|Patch\)\]" --include="*.cs"
grep -rn "@app\.\(route\|get\|post\)" --include="*.py"

# Find forms and user input
grep -rn "<form\|<input\|<textarea\|<select" --include="*.html" --include="*.tsx" --include="*.vue"

# Find file upload handlers
grep -rn "upload\|multipart\|formData\|IFormFile" -l

# Find webhook/queue consumers
grep -rn "webhook\|queue\|consumer\|subscriber" -l
```

For each entry point, note: authentication requirement, input sources, data sensitivity.

## Step 2: Auth Flow Analysis

Trace the full authentication and authorization path:

1. How are credentials submitted? (form, header, cookie)
2. How are they validated? (database lookup, JWT verification, OAuth flow)
3. How is the session maintained? (JWT, session cookie, token refresh)
4. How is authorization checked? (middleware, per-endpoint, attribute-based)
5. What happens on auth failure? (error message, rate limiting, lockout)

Look for:
- Missing auth on endpoints that should require it
- Authorization checks that only check authentication ("is logged in" but not "can access this resource")
- IDOR vulnerabilities (can user A access user B's data by changing an ID?)
- Token handling issues (stored in localStorage? No expiry? No rotation?)

## Step 3: Dependency Chain Audit

```bash
# JavaScript
npm audit 2>/dev/null
npx better-npm-audit audit 2>/dev/null

# .NET
dotnet list package --vulnerable 2>/dev/null

# Go
govulncheck ./... 2>/dev/null

# Check for abandoned packages
# Look for: last publish date, open issues, maintainer activity
```

Beyond known CVEs:
- Any dependencies pulling in unexpected transitive dependencies?
- Any dependencies with excessive permissions (file system, network)?
- Supply chain risk: are dependencies from trusted sources?

## Step 4: Infrastructure Config

```bash
# Docker
grep -r "USER\|EXPOSE\|ENV\|ARG.*secret\|COPY.*\.env" Dockerfile* 2>/dev/null

# Kubernetes
grep -rn "securityContext\|privileged\|runAsRoot\|capabilities" k8s/ 2>/dev/null
grep -rn "kind: Secret" k8s/ 2>/dev/null

# Environment and secrets
grep -rn "password\|secret\|key\|token" .env* docker-compose* 2>/dev/null
```

Check for:
- Containers running as root
- Exposed ports that shouldn't be public
- Default credentials
- Secrets in plaintext config
- Missing network policies
- Overly permissive CORS

## Step 5: Exploitation Paths

For each finding, think through the attack:

1. **How would you exploit this?** Be specific: what request, what payload, what sequence
2. **What's the impact?** Data exposure, privilege escalation, denial of service, RCE
3. **What's the likelihood?** Does the attacker need to be authenticated? Special knowledge?
4. **How easy is it?** Script kiddie vs. targeted attack

## Step 6: Report

| Severity | Criteria |
|----------|---------|
| **Critical** | RCE, auth bypass, mass data exposure. Fix immediately. |
| **High** | Privilege escalation, IDOR, SQL injection, XSS. Fix before release. |
| **Medium** | Information disclosure, missing headers, verbose errors. Fix soon. |
| **Low** | Minor hardening, best practice deviations. Fix when convenient. |

For each finding:
1. What the vulnerability is
2. Where it exists (file, line, endpoint)
3. How it could be exploited
4. Recommended fix
5. Severity with justification

See `../_shared/security-checklist.md` for the detailed checklist and `../codebase-audit/references/owasp-top-10.md` for OWASP patterns.
