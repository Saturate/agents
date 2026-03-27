# CI/CD Pipeline Security

Reference for: Codebase Audit

Detect security issues in CI/CD pipelines. Covers GitHub Actions, Azure Pipelines, and GitLab CI.

## Table of Contents

1. [GitHub Actions](#github-actions)
2. [Azure Pipelines](#azure-pipelines)
3. [GitLab CI](#gitlab-ci)
4. [General CI/CD Issues](#general-cicd-issues)
5. [When to Flag as Critical](#when-to-flag-as-critical)
6. [When to Flag as Important](#when-to-flag-as-important)

---

## GitHub Actions

### Detection

```bash
# Find workflow files
ls .github/workflows/*.yml .github/workflows/*.yaml 2>/dev/null
```

### pull_request_target Abuse (Critical)

`pull_request_target` runs with full repo permissions and access to secrets, even for PRs from forks. If the workflow checks out PR code, an attacker can exfiltrate secrets.

```bash
# Find workflows using pull_request_target
grep -rn "pull_request_target" .github/workflows/

# Dangerous: pull_request_target + checkout of PR code
grep -B5 -A10 "pull_request_target" .github/workflows/ | grep -i "checkout\|head.sha\|head.ref"
```

**Safe:** `pull_request_target` that only reads metadata or adds labels without checking out PR code.

**Dangerous:** `pull_request_target` combined with:
- `actions/checkout` with `ref: ${{ github.event.pull_request.head.sha }}`
- `ref: ${{ github.event.pull_request.head.ref }}`
- Any step that runs PR-supplied code (build, test, script)

The attack: attacker opens a PR that modifies a build script or workflow, `pull_request_target` checks out their code and runs it with access to secrets.

### Script Injection (Critical)

Untrusted input interpolated directly into `run:` blocks.

```bash
# Find direct interpolation in run blocks
grep -rn 'run:.*\${{' .github/workflows/
grep -rn '\${{ github.event' .github/workflows/
```

**Dangerous patterns:**
```yaml
# Bad - attacker controls PR title, can inject commands
run: echo "PR title: ${{ github.event.pull_request.title }}"

# Bad - attacker controls issue body
run: |
  comment="${{ github.event.comment.body }}"
  process "$comment"
```

**Safe pattern:**
```yaml
# Good - use environment variable, shell handles escaping
env:
  PR_TITLE: ${{ github.event.pull_request.title }}
run: echo "PR title: $PR_TITLE"
```

Attacker-controlled inputs: `github.event.pull_request.title`, `github.event.pull_request.body`, `github.event.comment.body`, `github.event.issue.title`, `github.event.issue.body`, `github.head_ref`.

### Overly Permissive Permissions (Important)

```bash
# Check for write-all or no permissions set (defaults to write-all in some configs)
grep -rn "permissions:" .github/workflows/
grep -rn "contents: write\|packages: write\|actions: write" .github/workflows/

# Workflows without any permissions block
for f in .github/workflows/*.yml .github/workflows/*.yaml; do
  grep -q "permissions:" "$f" || echo "No permissions set: $f"
done 2>/dev/null
```

Best practice: set `permissions: {}` at the top level and grant per-job.

### Pinned Actions (Important)

```bash
# Find actions using tags instead of SHA pins
grep -rn "uses:.*@v[0-9]" .github/workflows/
grep -rn "uses:.*@main\|uses:.*@master" .github/workflows/
```

Tags are mutable. A compromised action can push malicious code to an existing tag. Pin to full SHA:
```yaml
# Bad - tag can be moved
uses: actions/checkout@v4

# Good - immutable
uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11 # v4.1.1
```

### Self-hosted Runner Risks (Important)

```bash
# Check for self-hosted runners
grep -rn "runs-on:.*self-hosted" .github/workflows/
```

Self-hosted runners persist between jobs. If a public repo uses them, any fork PR can run code on your infrastructure. Check if self-hosted runners are restricted to private repos.

### Secrets in Logs (Important)

```bash
# Check for secrets passed as arguments (may leak in logs)
grep -rn '\${{ secrets\.' .github/workflows/ | grep -v "env:\|with:"

# Check for debug logging that might expose secrets
grep -rn "ACTIONS_RUNNER_DEBUG\|ACTIONS_STEP_DEBUG" .github/workflows/
```

### Third-party Actions Without Audit (Minor)

```bash
# List all third-party actions (not actions/ or github/ org)
grep -rn "uses:" .github/workflows/ | grep -v "actions/\|github/\|./\|docker://" | sort -u
```

Each third-party action is code you're trusting with your repo and secrets. Check if they're from known publishers.

## Azure Pipelines

### Detection

```bash
ls azure-pipelines.yml .azure-pipelines/*.yml 2>/dev/null
ls **/azure-pipelines*.yml 2>/dev/null
```

### Fork PR Builds with Secrets (Critical)

```bash
# Check if fork builds have access to secrets
grep -rn "forkProtectionEnabled\|isForksAllowed" azure-pipelines.yml
```

By default Azure Pipelines can expose secrets to fork PRs if not configured correctly. Check project settings for "Protect access to repositories in YAML pipelines" and "Limit job authorization scope."

### Variable Groups Without Restrictions (Important)

```bash
# Find variable group references
grep -rn "group:" azure-pipelines.yml | grep -v "^#"

# Check for inline secrets (should use variable groups or key vault)
grep -rn "password:\|secret:\|token:\|apikey:" azure-pipelines.yml | grep -v "variable"
```

### Pipeline Decorators and Templates (Important)

```bash
# Check for extends templates (good - enforced by org)
grep -rn "extends:" azure-pipelines.yml

# Check for inline scripts vs task references
grep -rn "script:\|bash:\|powershell:" azure-pipelines.yml | wc -l
```

Long inline scripts are harder to audit than referenced tasks.

### Missing Branch Policies (Important)

Can't detect from code alone, but flag if:
- No `trigger:` or `pr:` section restricting which branches run the pipeline
- Pipeline runs on `*` (all branches)

```bash
grep -rn "trigger:" azure-pipelines.yml
grep -A5 "trigger:" azure-pipelines.yml | grep "branches\|include\|exclude"
```

## GitLab CI

### Detection

```bash
ls .gitlab-ci.yml 2>/dev/null
```

### Privileged Docker Runners (Critical)

```bash
grep -rn "privileged\|docker-in-docker\|dind" .gitlab-ci.yml
```

Privileged containers can escape to the host. Only use for genuine Docker-in-Docker needs, and never on shared runners.

### Unprotected Variables (Important)

```bash
# Check for variables that should be protected
grep -rn "variables:" .gitlab-ci.yml
grep -A20 "variables:" .gitlab-ci.yml | grep -i "password\|secret\|token\|key"
```

Variables should be marked as protected and masked in GitLab project settings.

### Allow Failure on Security Jobs (Important)

```bash
grep -B5 -A5 "allow_failure: true" .gitlab-ci.yml | grep -i "security\|sast\|dast\|scan"
```

Security scanning jobs set to `allow_failure: true` means vulnerabilities won't block the pipeline.

### Artifacts Containing Secrets (Minor)

```bash
# Check what's being exported as artifacts
grep -A10 "artifacts:" .gitlab-ci.yml | grep "paths:"
```

Build artifacts are downloadable. Make sure they don't contain `.env` files, credentials, or private keys.

## General CI/CD Issues

### Secrets in Pipeline Config (Critical)

```bash
# Hardcoded credentials in any pipeline file
grep -rn 'password.*=\|secret.*=\|token.*=\|apikey.*=' .github/workflows/ azure-pipelines.yml .gitlab-ci.yml 2>/dev/null | grep -v '\${{.*secrets\|variables\.\|env\.'
```

### No Dependency Pinning (Important)

```bash
# Docker images without tags or using :latest
grep -rn "image:.*latest\|image:.*[^:]*$" .github/workflows/ azure-pipelines.yml .gitlab-ci.yml 2>/dev/null

# Container images without digest
grep -rn "image:\|container:" .github/workflows/ azure-pipelines.yml .gitlab-ci.yml 2>/dev/null | grep -v "@sha256:"
```

### Missing Security Scanning (Important)

```bash
# Check if any security scanning exists
grep -rn "snyk\|trivy\|grype\|semgrep\|codeql\|sast\|dast\|govulncheck\|npm audit\|safety\|bandit" .github/workflows/ azure-pipelines.yml .gitlab-ci.yml 2>/dev/null
```

No security scanning in CI is worth flagging. At minimum there should be dependency vulnerability scanning.

### Overly Broad Triggers (Minor)

```bash
# Runs on every push to every branch
grep -A5 "^on:" .github/workflows/*.yml 2>/dev/null | grep "push:" -A3
grep -A5 "trigger:" azure-pipelines.yml 2>/dev/null
```

Pipelines that run on every push to every branch waste resources and increase attack surface.

---

## When to Flag as Critical

- `pull_request_target` checking out PR code (secret exfiltration)
- Script injection via untrusted input interpolation
- Hardcoded secrets in pipeline files
- Privileged Docker runners on shared infrastructure
- Fork PR builds with secret access

## When to Flag as Important

- Actions pinned to tags instead of SHAs
- No permissions block (defaults to write-all)
- Self-hosted runners on public repos
- No security scanning in CI
- Variable groups without access restrictions
- Docker images using `:latest` or no tag
- Security jobs with `allow_failure: true`
