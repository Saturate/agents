# Docker & Kubernetes Patterns

Shared reference for deployment-related reviews and launch readiness.

## Dockerfile Best Practices

### Layer Optimization

Order matters for caching. Things that change least go first:

```dockerfile
# 1. Base image (changes rarely)
FROM node:22-alpine AS base

# 2. System deps (changes rarely)
RUN apk add --no-cache dumb-init

# 3. Package manager files (changes when deps change)
COPY package.json package-lock.json ./

# 4. Install deps (cached unless package files changed)
RUN npm ci --production

# 5. App code (changes most often - last layer)
COPY . .
```

Same pattern for .NET:
```dockerfile
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
COPY *.csproj .
RUN dotnet restore          # Cached unless csproj changed
COPY . .
RUN dotnet publish -c Release -o /app
```

### Multi-Stage Builds

Always separate build from runtime:
- Build stage: SDK, dev tools, compilers
- Runtime stage: Minimal base image, only production artifacts
- Go: Build in SDK image, copy single binary to `scratch` or `alpine`
- .NET: Build in SDK, run in `aspnet` runtime image
- Node: Build in full image, run in `alpine` with production deps only

### Security

- Never run as root: `USER nonroot` or `USER 1000`
- No secrets in images (use build args or runtime env vars)
- Use `.dockerignore` to exclude `.git`, `node_modules`, `.env`, test files
- Pin base image versions (not `latest`)
- Scan images for vulnerabilities (Trivy, Snyk)

### Health Checks

```dockerfile
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1
```

## Kubernetes Patterns

### Probes

| Probe | Purpose | When |
|-------|---------|------|
| Startup | App is initialized | Slow-starting apps, database migrations |
| Liveness | App is alive | Restart on deadlock/hang |
| Readiness | App can serve traffic | Remove from service during overload |

- Startup probe: generous timeout, check once
- Liveness probe: lightweight check, don't hit database
- Readiness probe: can check dependencies (DB, cache)

### Resource Management

Always set resource requests and limits:
```yaml
resources:
  requests:
    cpu: 100m
    memory: 128Mi
  limits:
    cpu: 500m
    memory: 512Mi
```

- Requests = what the scheduler guarantees
- Limits = hard ceiling before OOM kill / CPU throttle
- Start conservative, tune based on actual usage

### Secrets

- Never plain text in manifests
- Use: Kubernetes Secrets (base64, not encrypted at rest by default), Sealed Secrets, External Secrets Operator, Azure Key Vault provider
- Mount as files, not env vars (env vars show up in process listings and crash dumps)

### Rolling Updates

```yaml
strategy:
  type: RollingUpdate
  rollingUpdate:
    maxSurge: 1
    maxUnavailable: 0
```

- `maxUnavailable: 0` means zero downtime (new pod starts before old one stops)
- Ensure readiness probe is configured, otherwise K8s sends traffic to unready pods
- PodDisruptionBudget for availability during node maintenance
