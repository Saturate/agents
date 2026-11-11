import { expect, test } from 'claude-code/testing'

import { commandSegments, judge, parseRules } from './rules'

const RULES = parseRules(
  [
    'gate\t^[[:space:]]*git[[:space:]]+push[[:space:]]+.*(-f|--force)\tconfirm-destructive\tThis force-pushes.',
    'block\t^[[:space:]]*git[[:space:]]+commit\tcommit',
    'block\t^[[:space:]]*git[[:space:]]+push\tpush',
    'block\t^[[:space:]]*dotnet[[:space:]]+add[[:space:]]+package[[:space:]]+[^-[:space:]]\tevaluating-dependencies,nuget-package-management',
    'block\t^[[:space:]]*rm[[:space:]]+(-[[:alpha:]]+[[:space:]]+)*(--recursive|-[[:alpha:]]*[rR])\tsafe-delete',
    '# a comment',
    '',
  ].join('\n'),
)

const none = new Set<string>()

test('POSIX classes in the rules file become JS regex', () => {
  const verdict = (cmd: string) => judge(RULES, commandSegments(cmd), 'command', none).kind
  expect(verdict('rm -rf build')).toBe('block')
  expect(verdict('rm -r build')).toBe('block')
  expect(verdict('rm -v -R build')).toBe('block')
  expect(verdict('rm notes.txt')).toBe('allow')
})

test('a heredoc commit body that mentions git push is not a push', () => {
  const cmd = "git commit -m \"$(cat <<'EOF'\nfix: thing\n\ngit push origin main is next\nEOF\n)\""
  expect(commandSegments(cmd).filter(s => s.startsWith('git push'))).toEqual([])
  expect(judge(RULES, commandSegments(cmd), 'command', new Set(['commit'])).kind).toBe('allow')
})

test('chained, prefixed and substituted commands are each matched', () => {
  expect(commandSegments('cd repo && git push')).toContain('git push')
  expect(commandSegments('FOO=1 BAR="a b" git commit -m x')).toContain('git commit -m x')
  expect(commandSegments('echo $(git push)')).toContain('git push')
  expect(commandSegments('git -C ../other commit -m x')).toContain('git commit -m x')
  expect(commandSegments('sudo rm -rf /tmp/x')).toContain('rm -rf /tmp/x')
})

test('a quoted string never counts as a command', () => {
  expect(judge(RULES, commandSegments('echo "git commit is next"'), 'command', none).kind).toBe('allow')
})

test('a force push gets the gate, not the push skill', () => {
  const verdict = judge(RULES, commandSegments('git push --force origin x'), 'command', none)
  expect(verdict).toEqual({ kind: 'gate', messages: ['This force-pushes.'] })
})

test('a block needs every listed skill', () => {
  const segments = commandSegments('dotnet add package Foo')
  expect(judge(RULES, segments, 'command', new Set(['evaluating-dependencies']))).toEqual({
    kind: 'block',
    missing: ['nuget-package-management'],
  })
  expect(judge(RULES, segments, 'command', new Set(['evaluating-dependencies', 'nuget-package-management'])).kind).toBe('allow')
})

test('an apostrophe in a double-quoted message does not hide later commands', () => {
  expect(commandSegments(`git commit -m "it's done" && git push && echo 'ok'`)).toContain('git push')
})

test('a substitution inside double quotes is still a command', () => {
  expect(commandSegments('echo "$(git push)"')).toContain('git push')
  expect(commandSegments('out="$(git push 2>&1)"')).toContain('git push 2>')
})

test('shell keywords and binary paths do not hide a command', () => {
  expect(commandSegments('if true; then git push; fi')).toContain('git push')
  expect(commandSegments('/usr/bin/git commit -m x')).toContain('git commit -m x')
  expect(commandSegments('\\git commit -m x')).toContain('git commit -m x')
})

test('a broken pattern is skipped and the other rules still load', () => {
  const rules = parseRules('block\t^git(\tcommit\nblock\t^[[:space:]]*git[[:space:]]+push\tpush')
  expect(rules.length).toBe(1)
})

test('every segment of a chain is judged', () => {
  const verdict = judge(RULES, commandSegments('git commit -m x && git push'), 'command', new Set(['commit']))
  expect(verdict).toEqual({ kind: 'block', missing: ['push'] })
})
