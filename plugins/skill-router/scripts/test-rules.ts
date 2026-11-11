// Runs commands through the hooks module's rule engine with the real
// advisor-rules.conf, which `claude plugin test` can't read.
// Run: node plugins/skill-router/scripts/test-rules.ts
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { commandSegments, judge, parseRules } from '../hooks/rules.ts'

const here = dirname(fileURLToPath(import.meta.url))
const rules = parseRules(readFileSync(join(here, 'advisor-rules.conf'), 'utf8'))
const none = new Set<string>()

// Expected verdicts: 'allow', 'gate', or 'block:<skills, comma-separated>'.
const commands: Array<[string, string]> = [
  ['gh issue create --title x --body y', 'gate'],
  ['gh pr review 12 --approve', 'gate'],
  ['gh pr comment 12 --body hi', 'gate'],
  ['az repos pr create --thread x', 'gate'],
  ['git push --force origin main', 'gate'],
  ['git push --force-with-lease', 'gate'],
  ['git push -f', 'gate'],
  ['git push origin +main', 'gate'],
  ['git reset --hard HEAD~1', 'gate'],
  ['git reset --hard', 'gate'],
  ['gh repo fork owner/repo', 'gate'],
  ['git reset --soft HEAD~1 && git push --force', 'gate'],
  ['git push -fu origin main', 'gate'],
  ['PATH=$(pwd)/bin:$PATH git push', 'block:push'],
  ['TAG=`date +%s`-x git push', 'block:push'],
  ['X=$(cat f):y git reset --hard', 'gate'],
  ['echo $(git push)', 'block:push'],
  ['echo `git commit -m x`', 'block:commit'],
  ['git push \\\n  --force origin main', 'gate'],
  ['rm \\\n  -rf build', 'block:safe-delete'],
  ['echo C:\\\\\ngit push --force origin main', 'gate'],
  ['echo done \\\\\nrm -rf build', 'block:safe-delete'],
  ['git push -uf origin main', 'gate'],
  ['git push --follow-tags', 'block:push'],
  ['cat <<EOF > msg.txt && git commit -F msg.txt\nfix: thing\nEOF', 'block:commit'],
  ["cat > notes.md <<'EOF' && git add notes.md && git commit -m notes\nhello\nEOF", 'block:commit'],
  ["cat <<'EOF' | git commit -F -\nfix: thing\nEOF", 'block:commit'],
  ['git push origin my-feature', 'block:push'],
  ['git push origin feature-fix', 'block:push'],
  ['git push', 'block:push'],
  ['git push origin main > /dev/null 2>&1', 'block:push'],
  ['git commit -m "x"', 'block:commit'],
  ["git commit -m \"$(cat <<'EOF'\nfix: a\n\ngit push later\nEOF\n)\"", 'block:commit'],
  ['git add . && git commit -m x', 'block:commit'],
  ['git status; git commit', 'block:commit'],
  ["git commit -m \"it's done\" && git push && echo 'ok'", 'block:commit,push'],
  ['gh pr create --title t --body b', 'block:make-pr'],
  ['az repos pr create --title t', 'block:make-pr'],
  ['npm install left-pad', 'block:evaluating-dependencies'],
  ['pnpm add zod', 'block:evaluating-dependencies'],
  ['yarn add zod', 'block:evaluating-dependencies'],
  ['bun add zod', 'block:evaluating-dependencies'],
  ['cargo add serde', 'block:evaluating-dependencies'],
  ['pip install requests', 'block:evaluating-dependencies'],
  ['uv add requests', 'block:evaluating-dependencies'],
  ['go get example.com/x@v1', 'block:evaluating-dependencies'],
  ['dotnet add package Foo', 'block:evaluating-dependencies,nuget-package-management'],
  ['cd app && npm install zod', 'block:evaluating-dependencies'],
  ['rm -rf build', 'block:safe-delete'],
  ['rm --recursive build', 'block:safe-delete'],
  ['rm -r dir', 'block:safe-delete'],
  ['rm build -rf', 'block:safe-delete'],
  ['rm --force --recursive build', 'block:safe-delete'],
  ['npm install', 'allow'],
  ['npm install -D', 'allow'],
  ['git reset', 'allow'],
  ['git reset --soft HEAD~1', 'allow'],
  ['gh issue list', 'allow'],
  ['gh pr list', 'allow'],
  ['gh pr view 12', 'allow'],
  ['git status', 'allow'],
  ['git log --oneline', 'allow'],
  ['rm notes.txt', 'allow'],
  ['echo "git commit later"', 'allow'],
]

const tools: Array<[string, string]> = [
  ['mcp__ado__repo_create_pull_request', 'gate'],
  ['mcp__ado__repo_pull_request_write', 'gate'],
  ['mcp__ado__repo_pull_request_thread_write', 'gate'],
  ['mcp__ado__wit_work_item_comment_write', 'gate'],
  ['mcp__ado__repo_pull_request', 'allow'],
]

function verdictOf(targets: string[], target: 'command' | 'tool'): string {
  const verdict = judge(rules, targets, target, none)
  return verdict.kind === 'block' ? `block:${[...verdict.missing].sort().join(',')}` : verdict.kind
}

function normalize(expected: string): string {
  return expected.startsWith('block:') ? `block:${expected.slice(6).split(',').sort().join(',')}` : expected
}

let failed = 0
for (const [command, expected] of commands) {
  const got = verdictOf(commandSegments(command), 'command')
  if (got !== normalize(expected)) {
    failed++
    console.log(`FAIL ${JSON.stringify(command)}: want ${normalize(expected)}, got ${got}`)
  }
}
for (const [tool, expected] of tools) {
  const got = verdictOf([tool], 'tool')
  if (got !== normalize(expected)) {
    failed++
    console.log(`FAIL tool ${tool}: want ${expected}, got ${got}`)
  }
}
const total = commands.length + tools.length
console.log(`${total - failed}/${total} rule cases pass`)
process.exit(failed === 0 ? 0 : 1)
