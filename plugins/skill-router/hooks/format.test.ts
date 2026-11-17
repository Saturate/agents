import { expect, test } from 'claude-code/testing'

import { formatCommand, formatTool, shellWords } from './format'

test('shell words resolve quotes, escapes and a quoted heredoc', () => {
  expect(shellWords(`gh pr comment 1 --body 'a b' -F "c\\"d" e\\ f`)).toEqual(['gh', 'pr', 'comment', '1', '--body', 'a b', '-F', 'c"d', 'e f'])
  expect(shellWords(`x --body "$(cat <<'EOF'\nhas $HOME\nEOF\n)"`)).toEqual(['x', '--body', 'has $HOME'])
})

test('anything the shell decides at run time is not read', () => {
  for (const command of [
    'gh pr comment 1 --body "$HOME"',
    'gh pr comment 1 --body "$(cat notes.md)"',
    'gh pr comment 1 --body `date`',
    'gh pr comment 1 --body x; rm y',
    'gh pr comment 1 --body x && gh pr comment 2',
    'gh pr comment $N',
    'gh pr comment 1 --body *.md',
    'gh pr comment 1 # trailing',
    'gh pr comment 1 --body "unterminated',
    `x --body "$(cat <<EOF\nhas $HOME\nEOF\n)"`,
  ]) expect(shellWords(command)).toBe(undefined)
})

test('an unknown flag or command falls back to the command as written', () => {
  const odd = 'gh pr comment 1 --mystery x --body y'
  expect(formatCommand(odd)).toEqual({ text: odd, head: odd })
  expect(formatCommand('git reset --hard').text).toBe('git reset --hard')
})

test('an issue is laid out with its title in the head', () => {
  const shown = formatCommand('gh issue create --title "Crash on start" --label bug --body "Steps"')
  expect(shown.head).toBe('gh issue create "Crash on start"')
  expect(shown.text).toBe('gh issue create\n  Title   Crash on start\n  Labels  bug\n  Body\n  │ Steps')
})

test('posted text cannot pass for a field or redraw the screen', () => {
  const shown = formatCommand('gh pr comment 1 --title-less --body x')
  expect(shown.text).toBe('gh pr comment 1 --title-less --body x')
  const body = formatCommand(`gh pr comment 1 --body "$(cat <<'EOF'\n  PR  999\n\u001b[2Jgone\nEOF\n)"`)
  expect(body.text).toBe('gh pr comment\n  PR  1\n  Body\n  │   PR  999\n  │ \\u{1b}[2Jgone')
})

test('an empty body says so', () => {
  expect(formatCommand('gh pr comment 1 --body ""').text).toContain('│ (empty)')
})

test('an MCP call drops the reserved keys', () => {
  const shown = formatTool({ tool: 'mcp__ado__repo_pull_request_write', tool_use_id: 'u1', agentId: 'a', project: 'P', autoComplete: true })
  expect(shown).toEqual({ text: 'ado repo_pull_request_write\n  project       P\n  autoComplete  true', head: 'ado repo_pull_request_write' })
})

test('the heredoc ends at the first exact delimiter line, as in the shell', () => {
  const smuggled = `gh pr comment 1 --body "$(cat <<'EOF'\nhello\nEOF\ntouch pwned\ncat <<'EOF'\nworld\nEOF\n)"`
  expect(formatCommand(smuggled).text).toBe(smuggled)
  for (const fake of ['  EOF', 'EOF  ', 'EOF\r']) {
    const command = `gh pr comment 1 --body "$(cat <<'EOF'\nA\n${fake}\nB\nEOF\n)"`
    expect(formatCommand(command).text).toBe('gh pr comment\n  PR  1\n  Body\n  │ A\n  │ ' + fake.replace('\r', '\\u{d}') + '\n  │ B')
  }
  expect(shellWords(`x --body "$(cat\n<<'EOF'\nbody\nEOF\n)"`)).toBe(undefined)
  expect(shellWords(`x --body "$(cat <<'EOF'\nbody\n\n\nEOF\n)"`)).toEqual(['x', '--body', 'body'])
})

test('a repeated flag shows the command as written', () => {
  const command = 'gh pr comment 1 --body shown -b real'
  expect(formatCommand(command).text).toBe(command)
})

test('an MCP key that is not a plain name shows the call as JSON', () => {
  const shown = formatTool({ tool: 'mcp__ado__repo_pull_request_write', 'x\n  project  Victim': 'a', project: 'P' })
  expect(shown.text).toContain('"x\\n  project  Victim"')
})

test('bidi overrides and zero-width characters are escaped', () => {
  expect(formatCommand('gh pr comment 1 --body "safe \u202eevil\u200b"').text).toContain('safe \\u{202e}evil\\u{200b}')
})
