# Verifying Findings

Reference for: PR Review (Steps 2c, 2e, 2f, 2g)

A reviewer that only reads the diff misses what a human reviewer finds by running things. These recipes turn "this looks wrong" into "this fails, here is the output", and find what reading alone does not.

## Table of Contents

1. [CI Parity](#ci-parity)
2. [Evidence Rule](#evidence-rule)
3. [Probe Recipes](#probe-recipes)
4. [Baseline Comparison](#baseline-comparison)
5. [Cross-Boundary Contracts](#cross-boundary-contracts)
6. [Build and CI Changes](#build-and-ci-changes)

---

## CI Parity

Run this when the diff touches build, config, lockfile, workspace or pipeline files, or adds a workspace import. Skip it otherwise.

Local gates pass in a warm workspace that CI never has: built `dist/` folders, an existing `node_modules`, turbo/nx caches, generated files, untracked env files. Reproduce CI instead:

1. Find what CI runs. Read the pipeline definitions (`azure-pipelines.yml`, `**/Pipelines/*.yml`, `.github/workflows/*.yml`) and any shared templates they extend (often a sibling repo; look for a local checkout). Note the exact commands and their order, e.g. "install, then `pnpm --filter <app> lint`, then `test`, no build step".
2. Run those commands in a clean checkout of the PR head:
   ```bash
   scratch=$(mktemp -d)   # or the session scratchpad
   git worktree add --detach "$scratch/ci-parity" HEAD
   cd "$scratch/ci-parity" && pnpm install --frozen-lockfile   # or npm ci, dotnet restore, cargo fetch
   # then the pipeline's commands, in the pipeline's order
   ```
3. List pipelines whose path triggers match the diff but that do not run as PR validation. Their result is unknown until someone queues them; report them so the author queues them before merge.

Remove the worktree afterwards (`git worktree remove`).

## Evidence Rule

Every Critical or Important finding carries one of:

- a failing test or script, with its output (write it in a scratch directory, not the repo, unless the fix should keep it)
- command output that shows the behavior (`turbo run --dry=json`, a curl, a docker build log)
- a cited line from the other side of a contract (library source, backend code, engine docs)
- a quoted project guideline (CLAUDE.md, AGENT.md) next to the violating line
- for issues that can't be run (races, multi-user or timing attacks): a step-by-step trace through the code, marked unverified

A finding without evidence goes under Questions, phrased as what to check. This keeps confident guesses out of Important and makes real findings quick to accept.

## Probe Recipes

Pick the probes that match what the diff touches. Each one has found real bugs that reading missed.

**Pure functions (parsers, serializers, request builders):** call them with empty, single, duplicate, unicode, very large, and prototype-ish keys (`constructor`, `__proto__`). Round-trip: `parse(serialize(x))` equals `x` for every state the UI can produce, including defaults and cleared values.

**State persisted in the URL or storage:**
- Deep link straight into a non-default state (filtered, sorted, page 9). Does it render correctly with nothing cached?
- Out-of-range values: page past the end, page size not in the allowed list, unknown sort column, empty string values.
- Clear or reset after a deep link: does the default come back when the user cleared it?
- Back/forward and reload keep the state.

**Async data with placeholders (`keepPreviousData`, optimistic updates, SWR):** what does the UI show and remember while the previous response stands in for the new one, and after the new request fails?

**Tables and lists:** first click on each sortable header (TanStack cycles asc, desc, none; a desc default may clear on first click). Ties in the sort key across pages. Columns that show a fallback value (`a ?? b`) but sort on `a` only. Empty and zero-result states versus filtered-to-zero states.

**Dropdowns, dialogs, popovers:** outside click, Escape, two open at once, focus return.

**Scripts and task runners:** run the changed script for real. Interactive prompts (port in use, confirm overwrite) under turbo/nx/concurrently, where stdin often doesn't reach the task. Cache hashes: change an input the task reads (config file, shared preset) and confirm the hash moves.

**Containers:** build the image the way CI does (CI may lack BuildKit). Check context size, final image size and contents, the user it runs as, and that it starts with the env the deployment manifests set.

## Baseline Comparison

For each user-facing page, command or script the diff touches, run or read the base branch version and list what it did: options, filters, columns, sort behavior, keyboard handling, prompts, error messages. Confirm each still exists on the PR head, or that the PR says why it was dropped. Silent removals ("the old page had a (none) filter") are regressions even when the new code is correct.

## Cross-Boundary Contracts

When the diff builds requests for, or relies on behavior of, another system, read that system before judging the code. Look for local checkouts of sibling repos first.

| Boundary | Check |
|---|---|
| Search engines (Elasticsearch, OpenSearch) | result window limit (`from + size` <= 10000 by default), sort on keyword vs text, case-sensitive keyword sort, ties without a tie-breaker, aggregations computed over the filtered query (facets narrow to their own filter), unmapped fields in sort |
| Backend wrappers (repo libraries that build the real request) | which defaults they add only in some cases (e.g. a tie-breaker only when no sort is sent), what they drop silently |
| REST/GraphQL APIs | nullable fields the UI treats as present, enum casing, pagination caps, error shapes |
| Databases | collation and case, NULL ordering, index use for the new filter |
| Build tools and bundlers | what package entry resolves to (`exports` pointing at gitignored `dist/`), what a prune/tree-shake step drops |
| CI templates | which steps actually run, in which pool, with which tool versions |

## Build and CI Changes

- A new runtime import of a workspace package: does it resolve in every place that runs without a prior build (tests in CI, typecheck on a fresh clone, Docker stages)?
- Task runner config: does each cached task's hash include every file it reads (shared lint config, tsconfig base, env files)?
- Dockerfiles: `.dockerignore` exists and excludes `node_modules`, build output and `.git`; layers ordered so dependency install caches; final stage carries only runtime output; non-root user.
- Pipelines: path triggers cover the packages the app now depends on.
