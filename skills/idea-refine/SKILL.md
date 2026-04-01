---
name: idea-refine
description: Sharpens vague ideas into actionable briefs by generating 3-5 options with tradeoffs, checking technical feasibility, and defining scope with a "Not Doing" list. Use when brainstorming, refining an idea, scoping a feature, exploring options, defining requirements, what should we build, unclear requirements, or when starting something new without a clear spec.
allowed-tools: Read Grep Glob Bash WebSearch
metadata:
  author: Saturate
  version: "1.0"
---

# Idea Refine

## Quick Gate

Before going through this process, check: are the requirements already clear and specific? If yes, skip to producing the brief output directly. This skill is for when things are vague or when you need to explore options.

## Progress Checklist

- [ ] Understand the core problem
- [ ] Identify constraints
- [ ] Generate 3-5 options with tradeoffs
- [ ] Check technical feasibility of top options
- [ ] Produce brief with scope and "Not Doing" list
- [ ] User picks direction

## Step 1: Extract the Core Problem

Ask and answer: **what are we actually solving?** Not what feature to build, but what problem exists.

- Who has this problem? (user, team, client, system)
- What happens if we don't solve it?
- Is there already something partially solving it?

If the user is vague, ask sharpening questions. Don't guess and run with assumptions.

## Step 2: Identify Constraints

Capture what limits the solution space:

- **Technical**: existing tech stack, infrastructure, integrations
- **Timeline**: deadline, release cycle, dependency on other work
- **Budget/scope**: client expectations, team capacity
- **Compliance**: regulatory requirements, data residency, accessibility
- **Existing work**: has this been solved before in another project? Check references, memories

## Step 3: Generate Options

Produce 3-5 concrete approaches. Not variations of the same idea, but genuinely different ways to solve the problem.

For each option:

| Option | Approach | Effort | Risk | Tradeoff |
|--------|----------|--------|------|----------|
| A | Description | Low/Med/High | Low/Med/High | What you give up |
| B | ... | ... | ... | ... |

Include at least one "minimal viable" option and one "proper solution" option. The user picks, not you.

## Step 4: Technical Feasibility Check

For the top 2-3 options:

- Does this work with the existing tech stack?
- Are there libraries/frameworks that handle the hard parts?
- What's the architectural impact? (new service, new dependency, schema change)
- Does anything similar already exist in the codebase or in another project?
- Are there known pitfalls with this approach?

Kill options that are technically unviable. Don't let them survive to the brief.

## Step 5: Produce Brief

Output a concise brief:

```markdown
## Problem
One sentence: what we're solving and for whom.

## Recommended Approach
Which option and why. 1-2 sentences.

## Scope
What we're building. Bullet points.

## Not Doing
What we're explicitly excluding. This is as important as the scope.
Prevents scope creep and misaligned expectations.

## Constraints
Key limitations that shape the solution.

## Open Questions
Anything still unclear that needs answers before implementation.
```

## Step 6: Get Direction

Present the brief and options to the user. They pick the direction or combine elements from multiple options. Don't proceed until there's a clear choice.

Once confirmed, this brief becomes input for plan mode or the pre-planning skill.
