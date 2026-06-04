#!/bin/bash
#
# Tests for skill-advisor.sh PreToolUse hook.
#
# Runs the real script with synthetic hook JSON on stdin and asserts on
# stdout + exit code.  No mocks, no test framework — just bash.
#
# Usage:  bash test-skill-advisor.sh

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ADVISOR="$SCRIPT_DIR/skill-advisor.sh"

PASSED=0
FAILED=0
ERRORS=""

# ── helpers ──────────────────────────────────────────────────────────

hook_input() {
  local tool="${1:-Bash}" cmd="${2:-}" session="${3:-test-$$}"
  jq -cn --arg t "$tool" --arg c "$cmd" --arg s "$session" \
    '{tool_name: $t, tool_input: {command: $c}, session_id: $s}'
}

run_advisor() {
  hook_input "$@" | bash "$ADVISOR" 2>/dev/null
}

assert_blocked() {
  local label="$1"; shift
  local out
  out=$(run_advisor "$@")
  local rc=$?
  if printf '%s' "$out" | jq -e '.decision == "block"' >/dev/null 2>&1; then
    PASSED=$((PASSED + 1))
  else
    FAILED=$((FAILED + 1))
    ERRORS="${ERRORS}\n  FAIL: $label — expected block, got: $out (exit $rc)"
  fi
}

assert_blocked_mentions() {
  local label="$1" skill="$2"; shift 2
  local out
  out=$(run_advisor "$@")
  if printf '%s' "$out" | jq -e '.decision == "block"' >/dev/null 2>&1 &&
     printf '%s' "$out" | jq -r '.reason' 2>/dev/null | grep -q "/$skill"; then
    PASSED=$((PASSED + 1))
  else
    FAILED=$((FAILED + 1))
    ERRORS="${ERRORS}\n  FAIL: $label — expected block mentioning /$skill, got: $out"
  fi
}

# Assert the command is blocked (gate) and the reason contains a substring
assert_gated() {
  local label="$1" substr="$2"; shift 2
  local out
  out=$(run_advisor "$@")
  if printf '%s' "$out" | jq -e '.decision == "block"' >/dev/null 2>&1 &&
     printf '%s' "$out" | jq -r '.reason' 2>/dev/null | grep -qi "$substr"; then
    PASSED=$((PASSED + 1))
  else
    FAILED=$((FAILED + 1))
    ERRORS="${ERRORS}\n  FAIL: $label — expected gate with '$substr', got: $out"
  fi
}

assert_silent() {
  local label="$1"; shift
  local out
  out=$(run_advisor "$@")
  local rc=$?
  if [ -z "$out" ] && [ "$rc" -eq 0 ]; then
    PASSED=$((PASSED + 1))
  else
    FAILED=$((FAILED + 1))
    ERRORS="${ERRORS}\n  FAIL: $label — expected silent exit 0, got: rc=$rc out='$out'"
  fi
}

# ── tests ────────────────────────────────────────────────────────────

echo "skill-advisor.sh tests"
echo "======================"
echo ""

# ── Gate: external-facing content ─────────────────────────────────────
echo "Gate rules: external-facing content"
assert_gated "gh issue create" "draft" \
  "Bash" "gh issue create --title 'bug' --body 'details'"
assert_gated "gh pr review" "review" \
  "Bash" "gh pr review 42 --approve"
assert_gated "gh pr comment" "comment" \
  "Bash" "gh pr comment 42 --body 'looks good'"
assert_gated "az pr thread" "comment" \
  "Bash" "az repos pr create --thread 'comment body'"

# ── Gate: destructive git operations ──────────────────────────────────
echo "Gate rules: destructive git"
assert_gated "git push --force" "force" \
  "Bash" "git push --force origin main"
assert_gated "git push --force-with-lease" "force" \
  "Bash" "git push --force-with-lease origin feat/branch"
assert_gated "git push -f" "force" \
  "Bash" "git push -f origin main"
assert_gated "git reset --hard" "discard" \
  "Bash" "git reset --hard HEAD~1"
assert_gated "git reset --hard (no ref)" "discard" \
  "Bash" "git reset --hard"

# ── Gate: irreversible external actions ───────────────────────────────
echo "Gate rules: irreversible external"
assert_gated "gh repo fork" "fork" \
  "Bash" "gh repo fork org/repo --clone=false"

# ── Gate: SKILL_ACK bypass for gates ─────────────────────────────────
echo "Gate SKILL_ACK bypass"
assert_silent "SKILL_ACK=draft-first gh issue create" \
  "Bash" "SKILL_ACK=draft-first gh issue create --title 'bug'"
assert_silent "SKILL_ACK=confirm-destructive git push --force" \
  "Bash" "SKILL_ACK=confirm-destructive git push --force origin main"
assert_silent "SKILL_ACK=confirm-destructive git reset --hard" \
  "Bash" "SKILL_ACK=confirm-destructive git reset --hard HEAD~1"
assert_silent "SKILL_ACK=confirm-external gh repo fork" \
  "Bash" "SKILL_ACK=confirm-external gh repo fork org/repo"

# ── Gate ordering: specific gates before general blocks ───────────────
echo "Gate ordering"
# Force push should hit the gate (destructive), not the push block
assert_gated "force push hits gate not push block" "force" \
  "Bash" "git push --force origin main"
# Normal push should hit the push block
assert_blocked_mentions "normal push hits push block" "push" \
  "Bash" "git push origin main"
# gh pr create should hit the make-pr block (not the gh pr comment gate)
assert_blocked_mentions "gh pr create hits block not gate" "make-pr" \
  "Bash" "gh pr create --title test"

# ── Gate: safe pass-through (non-destructive variants) ────────────────
echo "Gate pass-through: non-destructive variants"
assert_silent "git reset (no flag, unstage)" \
  "Bash" "git reset HEAD file.txt"
assert_silent "git reset --soft (not gated)" \
  "Bash" "git reset --soft HEAD~1"
assert_silent "gh issue list (read-only)" \
  "Bash" "gh issue list"
assert_silent "gh pr list (read-only)" \
  "Bash" "gh pr list"
assert_silent "gh pr view (read-only)" \
  "Bash" "gh pr view 42"

# ── Block: git commit ─────────────────────────────────────────────────
echo "Block rules: git commit"
assert_blocked_mentions "bare git commit" "commit" \
  "Bash" "git commit -m 'test'"
assert_blocked_mentions "git commit with flags" "commit" \
  "Bash" "git commit --amend --no-edit"
assert_blocked_mentions "git commit with heredoc body" "commit" \
  "Bash" 'git commit -m "$(cat <<'"'"'EOF'"'"'
test message
EOF
)"'

# ── Block: git push ───────────────────────────────────────────────────
echo "Block rules: git push"
assert_blocked_mentions "bare git push" "push" \
  "Bash" "git push"
assert_blocked_mentions "git push with remote/branch" "push" \
  "Bash" "git push -u origin feat/my-branch"
assert_blocked_mentions "git push with redirect" "push" \
  "Bash" "git push origin main 2>&1"

# ── Block: PR creation ────────────────────────────────────────────────
echo "Block rules: PR creation"
assert_blocked_mentions "gh pr create" "make-pr" \
  "Bash" "gh pr create --title test --body body"
assert_blocked_mentions "gh pr create long" "make-pr" \
  "Bash" "gh pr create --repo org/repo --head branch --base main --title test"
assert_blocked_mentions "az repos pr create" "make-pr" \
  "Bash" "az repos pr create --title test --description body"

# ── Block: package install ────────────────────────────────────────────
echo "Block rules: package install"
assert_blocked_mentions "npm install pkg" "evaluating-dependencies" \
  "Bash" "npm install lodash"
assert_blocked_mentions "pnpm add pkg" "evaluating-dependencies" \
  "Bash" "pnpm add zod@3.22.0"
assert_blocked_mentions "yarn add pkg" "evaluating-dependencies" \
  "Bash" "yarn add react"
assert_blocked_mentions "bun add pkg" "evaluating-dependencies" \
  "Bash" "bun add elysia"
assert_blocked_mentions "cargo add crate" "evaluating-dependencies" \
  "Bash" "cargo add tokio"
assert_blocked_mentions "pip install pkg" "evaluating-dependencies" \
  "Bash" "pip install requests"
assert_blocked_mentions "uv add pkg" "evaluating-dependencies" \
  "Bash" "uv add pytest"
assert_blocked_mentions "go get module" "evaluating-dependencies" \
  "Bash" "go get github.com/gin-gonic/gin@v1.9.1"
assert_blocked_mentions "dotnet add package" "evaluating-dependencies" \
  "Bash" "dotnet add package Serilog"

# ── Block: rm -r ──────────────────────────────────────────────────────
echo "Block rules: destructive delete"
assert_blocked_mentions "rm -rf" "safe-delete" \
  "Bash" "rm -rf node_modules"
assert_blocked_mentions "rm --recursive" "safe-delete" \
  "Bash" "rm --recursive dist/"
assert_blocked_mentions "rm -r dir" "safe-delete" \
  "Bash" "rm -r build/"

# ── SKILL_ACK bypass (blocks) ────────────────────────────────────────
echo "SKILL_ACK bypass (blocks)"
assert_silent "SKILL_ACK=commit git commit" \
  "Bash" "SKILL_ACK=commit git commit -m 'test'"
assert_silent "SKILL_ACK=push git push" \
  "Bash" "SKILL_ACK=push git push origin main"
assert_silent "SKILL_ACK=make-pr gh pr create" \
  "Bash" "SKILL_ACK=make-pr gh pr create --title test"
assert_silent "SKILL_ACK=evaluating-dependencies npm install" \
  "Bash" "SKILL_ACK=evaluating-dependencies npm install lodash"
assert_silent "SKILL_ACK=safe-delete rm -rf" \
  "Bash" "SKILL_ACK=safe-delete rm -rf node_modules"

# ── Compound commands ─────────────────────────────────────────────────
echo "Compound commands"
assert_blocked_mentions "git add && git commit (compound)" "commit" \
  "Bash" "git add . && git commit -m 'test'"
# commit + push compound: blocks on commit (first block rule wins)
assert_blocked_mentions "git commit && git push blocks on commit" "commit" \
  "Bash" "git commit -m 'test' && git push origin main"
# push-only compound: blocks on push
assert_blocked_mentions "git add && git push (compound)" "push" \
  "Bash" "git add . && git push origin main"
assert_blocked_mentions "cd && npm install pkg" "evaluating-dependencies" \
  "Bash" "cd app && npm install lodash"
assert_blocked_mentions "semicolon git commit" "commit" \
  "Bash" "git add .; git commit -m 'test'"
assert_blocked_mentions "rm -rf in compound" "safe-delete" \
  "Bash" "cd build && rm -rf dist/"
# gate in compound: force push after reset
assert_gated "reset --soft && force push (compound)" "force" \
  "Bash" "git reset --soft HEAD~1 && git push --force-with-lease origin feat/branch"

# ── SKILL_ACK inside compound commands ────────────────────────────────
echo "SKILL_ACK in compound commands"
assert_silent "git add && SKILL_ACK=commit git commit" \
  "Bash" "git add file.ts && SKILL_ACK=commit git commit -m 'test'"
assert_silent "SKILL_ACK=confirm-destructive in compound" \
  "Bash" "git reset --soft HEAD~1 && SKILL_ACK=confirm-destructive git push --force origin main"
# All segments acknowledged → pass through
assert_silent "all segments have SKILL_ACK" \
  "Bash" "SKILL_ACK=commit git commit -m 'test' && SKILL_ACK=push git push origin main"

# ── SKILL_ACK partial: unacknowledged segments still blocked ──────────
echo "SKILL_ACK partial bypass (unacked segments still caught)"
# Bundling a force push with an acked commit must still block the push
assert_gated "acked commit + unacked force push" "force" \
  "Bash" "SKILL_ACK=commit git commit -m 'test' && git push --force origin main"
# Bundling an acked commit + unacked normal push
assert_blocked_mentions "acked commit + unacked push" "push" \
  "Bash" "SKILL_ACK=commit git commit -m 'test' && git push origin main"
# Acked install + unacked rm -rf
assert_blocked_mentions "acked install + unacked rm" "safe-delete" \
  "Bash" "SKILL_ACK=evaluating-dependencies npm install lodash && rm -rf dist"

# ── Pass-through (no match) ──────────────────────────────────────────
echo "Pass-through: non-matching commands"
assert_silent "git status" \
  "Bash" "git status"
assert_silent "git log" \
  "Bash" "git log --oneline -5"
assert_silent "git diff" \
  "Bash" "git diff HEAD~1"
assert_silent "git add" \
  "Bash" "git add ."
assert_silent "git branch" \
  "Bash" "git branch -a"
assert_silent "npm run build" \
  "Bash" "npm run build"
assert_silent "npm test" \
  "Bash" "npm test"
assert_silent "ls" \
  "Bash" "ls -la"
assert_silent "cat file" \
  "Bash" "cat package.json"
assert_silent "echo" \
  "Bash" "echo hello"

# ── Pass-through: bare restore (no named package) ────────────────────
echo "Pass-through: package restore (no named package)"
assert_silent "npm install (bare)" \
  "Bash" "npm install"
assert_silent "npm i (bare)" \
  "Bash" "npm i"
assert_silent "pnpm install (bare)" \
  "Bash" "pnpm install"
assert_silent "yarn install (bare)" \
  "Bash" "yarn install"
assert_silent "npm install --save-dev (no pkg)" \
  "Bash" "npm install --save-dev"

# ── Pass-through: rm without -r ──────────────────────────────────────
echo "Pass-through: non-recursive rm"
assert_silent "rm single file" \
  "Bash" "rm file.txt"
assert_silent "rm -f single file" \
  "Bash" "rm -f temp.log"

# ── Non-Bash tool calls ──────────────────────────────────────────────
echo "Non-Bash tool calls"
assert_silent "Read tool" \
  "Read" "anything"
assert_silent "Edit tool" \
  "Edit" "anything"
assert_silent "Write tool" \
  "Write" "anything"

# ── results ──────────────────────────────────────────────────────────

echo ""
echo "=============================="
echo "Results: $PASSED passed, $FAILED failed"
if [ "$FAILED" -gt 0 ]; then
  echo ""
  echo "Failures:"
  printf "$ERRORS\n"
  echo ""
  exit 1
else
  echo "All tests passed."
  exit 0
fi
