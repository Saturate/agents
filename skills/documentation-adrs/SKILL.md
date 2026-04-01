---
name: documentation-adrs
description: Records architecture decisions to memory provider when significant technical choices are made. Lightweight format capturing what was decided, why, alternatives considered, and tradeoffs. Use when recording a decision, documenting architecture, ADR, architecture decision record, why did we choose, technical decision, or when a significant choice is made about dependencies, patterns, or infrastructure.
allowed-tools: Read Grep Glob Bash
metadata:
  author: Saturate
  version: "1.0"
---

# Architecture Decision Records

Document decisions, not just code. When someone asks "why did we do it this way?" six months from now, the answer should exist.

## Progress Checklist

- [ ] Detect if this is a significant decision
- [ ] Check memories for related past decisions
- [ ] Capture the decision
- [ ] Store to memory provider

## When to Record

Not every choice is worth recording. Record when:

- **New dependency** added (framework, library, service)
- **Architecture pattern** chosen (monolith vs microservice, state management, data access pattern)
- **Infrastructure decision** (hosting, database, caching layer, message queue)
- **Security model** defined or changed (auth strategy, encryption approach)
- **Significant tradeoff** made (chose speed over correctness, chose simplicity over flexibility)

Don't record:
- Implementation details (naming a variable, choosing a loop structure)
- Obvious choices (using TypeScript in a TypeScript project)
- Temporary decisions (using a workaround until the real fix ships)

## Auto-Detection

Watch for these signals that a significant decision is being made:

```bash
# New dependencies being added
git diff --cached package.json go.mod *.csproj Directory.Packages.props

# New infrastructure config
git diff --cached docker-compose* Dockerfile* k8s/ terraform/ bicep/ .github/workflows/ azure-pipelines*

# New auth patterns
git diff --cached | grep -i "auth\|jwt\|oauth\|session\|identity"
```

## Step 1: Check Existing Decisions

Before recording, check if there's a related past decision:

- Query memory provider for the topic area
- Look for ADR files in the repo (`docs/adr/`, `decisions/`)
- Check if this contradicts or supersedes a previous decision

If superseding, note what's changed and why.

## Step 2: Capture the Decision

Lightweight format:

```markdown
## Decision: [Short title]

**Date:** YYYY-MM-DD
**Status:** Accepted

### Context
What prompted this decision? What problem are we solving?

### Decision
What did we decide? One or two sentences.

### Alternatives Considered
- **Option A**: [what it was] - rejected because [why]
- **Option B**: [what it was] - rejected because [why]

### Tradeoffs
What are we giving up? What risks are we accepting?

### Consequences
What follows from this decision? What will we need to do/maintain?
```

Keep it concise. A good ADR is 10-20 lines, not a design document.

## Step 3: Store the Decision

**Primary: Memory provider**
Save to the memory system so it's available in future conversations. This is better than cluttering the repo for most decisions.

**Secondary: Repo (if appropriate)**
Some decisions are worth committing to the repo:
- Public API contracts
- Security architecture
- Decisions that affect onboarding (new team member needs to understand)

Store in `docs/adr/` or `decisions/` with a numbered filename: `001-use-postgres-over-cosmos.md`

## Reading Past Decisions

When starting work in an area, check for relevant ADRs:

- Query memories for the area/topic
- Check `docs/adr/` or `decisions/` in the repo
- Use context from past decisions to avoid contradicting them (or explicitly supersede with a reason)
