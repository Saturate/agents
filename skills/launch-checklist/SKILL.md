---
name: launch-checklist
description: Validates full deployment readiness beyond code, checking infrastructure, Docker configuration, Kubernetes manifests, environment config, monitoring, security headers, and pipeline status. Use when launching, deploying to production, release readiness, go-live, deployment check, pre-launch, shipping to prod, or when preparing for production deployment.
allowed-tools: Read Grep Glob Bash
metadata:
  author: Saturate
  version: "1.0"
---

# Launch Checklist

Is the whole thing ready to ship? Not just the code, everything.

## Progress Checklist

- [ ] Detect deployment target
- [ ] Code quality gates
- [ ] Infrastructure ready
- [ ] Docker / containers
- [ ] Kubernetes (if applicable)
- [ ] Environment config
- [ ] Monitoring and alerting
- [ ] Security headers and config
- [ ] Pipeline green
- [ ] Rollback plan exists

## Step 0: Detect Deployment Target

```bash
# What are we deploying to?
ls Dockerfile docker-compose* 2>/dev/null
ls k8s/ kubernetes/ helm/ 2>/dev/null
ls terraform/ bicep/ pulumi/ 2>/dev/null
ls .github/workflows/ azure-pipelines* .gitlab-ci* 2>/dev/null
ls vercel.json netlify.toml fly.toml 2>/dev/null
```

Adjust the checklist based on what's detected. Not everything applies to every deployment.

## 1. Code Quality

- [ ] All tests passing
- [ ] No known critical bugs
- [ ] Code reviewed (trigger `code-review` if not done)
- [ ] No TODO/FIXME/HACK markers in critical paths
- [ ] No `console.log` debug statements in production code
- [ ] Linting passes with no errors

## 2. Infrastructure

- [ ] DNS records configured and propagated
- [ ] SSL/TLS certificates valid and not expiring soon
- [ ] Load balancer configured (if applicable)
- [ ] CDN configured for static assets (if applicable)
- [ ] Firewall rules reviewed (only necessary ports exposed)
- [ ] Database accessible from production environment
- [ ] Backup strategy in place for data stores

## 3. Docker

If containerized, verify:

- [ ] Multi-stage build (build image separate from runtime image)
- [ ] Layers ordered for optimal caching (deps before code)
- [ ] No secrets in the image (no .env, no hardcoded keys)
- [ ] Running as non-root user
- [ ] Health check defined
- [ ] `.dockerignore` excludes .git, node_modules, test files
- [ ] Base image pinned to specific version (not `latest`)
- [ ] Image scanned for vulnerabilities

See `../_shared/docker-k8s-patterns.md` for detailed patterns.

## 4. Kubernetes

If deploying to K8s:

- [ ] Manifests valid (`kubectl apply --dry-run=client`)
- [ ] Resource requests and limits set
- [ ] Liveness probe configured (lightweight, don't hit DB)
- [ ] Readiness probe configured (can check dependencies)
- [ ] Startup probe for slow-starting apps
- [ ] Secrets from vault, not plaintext in manifests
- [ ] Rolling update strategy configured
- [ ] PodDisruptionBudget for availability
- [ ] HPA (Horizontal Pod Autoscaler) if traffic varies

See `../_shared/docker-k8s-patterns.md` for detailed patterns.

## 5. Environment Config

- [ ] All environment variables documented
- [ ] No hardcoded values for environment-specific config
- [ ] Secrets stored in vault (Azure Key Vault, AWS Secrets Manager, HashiCorp Vault)
- [ ] Connection strings use production endpoints
- [ ] Feature flags set correctly for production
- [ ] Logging level set appropriately (not debug in production)

## 6. Monitoring & Alerting

- [ ] Error tracking configured (Sentry, Application Insights)
- [ ] APM configured for request tracing
- [ ] Structured logging (JSON, with correlation IDs)
- [ ] Health check endpoint exists and returns meaningful status
- [ ] Alerts configured for: error rate spike, response time degradation, resource exhaustion
- [ ] Dashboard exists for key metrics

## 7. Security

- [ ] HTTPS enforced (HSTS header with appropriate max-age)
- [ ] CSP header configured
- [ ] X-Frame-Options or frame-ancestors CSP directive
- [ ] X-Content-Type-Options: nosniff
- [ ] CORS configured explicitly (no wildcard on auth endpoints)
- [ ] Rate limiting on auth and sensitive endpoints
- [ ] No secrets in source code or build artifacts
- [ ] Dependency audit clean (no critical/high vulnerabilities)

## 8. Pipeline

- [ ] CI pipeline green on the deployment branch
- [ ] No skipped tests
- [ ] All quality gates passing (lint, types, tests, security)
- [ ] Deployment targets the correct environment
- [ ] Previous staging/QA deployment verified by someone

## 9. Rollback Plan

Before deploying, know how to undo it:

- [ ] How to rollback: which command, which version to revert to
- [ ] Database changes: are they backward-compatible? Can old code run on new schema?
- [ ] How long does a rollback take?
- [ ] Who needs to be notified if rollback happens?
- [ ] Monitoring will detect if rollback is needed (error rate, latency)

## Post-Launch Verification

After deploying, verify within the first hour:

1. Health check returns 200
2. Error rate is normal (not spiking)
3. Response times are normal
4. Critical user flows work (login, core actions)
5. Logs are flowing
6. No unexpected errors in error tracking
