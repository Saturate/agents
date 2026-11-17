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
  const indented = `gh pr comment 1 --body "$(cat <<'EOF'\nA\n  EOF\nB\nEOF\n)"`
  expect(formatCommand(indented).text).toBe('gh pr comment\n  PR  1\n  Body\n  │ A\n  │   EOF\n  │ B')
  for (const fake of ['EOF  ', 'EOF\r']) {
    const command = `gh pr comment 1 --body "$(cat <<'EOF'\nA\n${fake}\nB\nEOF\n)"`
    expect(formatCommand(command).text).toBe(command)
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

test('a body bash would end early or close on is not read', () => {
  for (const body of ['hello\nEOF)"; echo PWNED; echo "', 'EOF x)', 'thanks :)', '1) first\n2) second']) {
    const command = `gh pr comment 1 --body "$(cat <<'EOF'\n${body}\nEOF\n)"`
    expect(formatCommand(command).text).toBe(command)
  }
  expect(formatCommand(`gh pr comment 1 --body "$(cat <<'EOF'\nsee (a) and (b)\nEOF\n)"`).text).toContain('│ see (a) and (b)')
})

test('a zsh =word is not read', () => {
  expect(shellWords('gh issue create --title =sh --body x')).toBe(undefined)
  expect(shellWords('gh pr comment 1 --body a=b')).toEqual(['gh', 'pr', 'comment', '1', '--body', 'a=b'])
})

test('tag characters and soft hyphens are escaped', () => {
  expect(formatCommand('gh pr comment 1 --body "ok\u{e0049}\u00ad"').text).toContain('ok\\u{e0049}\\u{ad}')
})

test('under bash, a body with quotes, backslashes or # is not read', () => {
  const heredoc = (body: string) => `"$(cat <<'EOF'\n${body}\nEOF\n)"`
  const cases = [
    `gh pr comment 1 --body ${heredoc('## Notes (draft\n) see $(touch PWN)')}`,
    `gh pr comment 1 --body ${heredoc('a \\( b ) see $(touch PWN)')}`,
    `gh issue create --title ${heredoc("Fix (it's) parsing")} --body ${heredoc('Repro ((see log: it\'s ))"; touch PWN; : "')}`,
    `gh issue create --title ${heredoc('Fix (\`code) parsing')} --body x`,
    `gh pr comment 1 --body ${heredoc("It's blocked")}`,
  ]
  for (const command of cases) expect(formatCommand(command).text).toBe(command)
  expect(formatCommand(`gh pr comment 1 --body ${heredoc("It's done, see #12")}`, true).text).toContain("│ It's done, see #12")
})

test('zsh options that change words are not trusted', () => {
  for (const command of ['gh pr comment 1 --body done#', "gh pr comment 1 --body 'it''s fine'", 'gh issue create --label P1,bug==ls --body x', 'gh pr comment 1 --body =ls', "gh pr comment 1 --body ''=gh", 'gh pr comment 1 --body ""=ls', 'gh pr comment 1 --body=a:=ls', "gh pr comment 1 --body=''=ls"]) {
    expect(shellWords(command, true)).toBe(undefined)
  }
  expect(shellWords('gh pr comment 1 --body=x', true)).toEqual(['gh', 'pr', 'comment', '1', '--body=x'])
})

test('an az value read from a file shows the command as written', () => {
  const command = 'az repos pr update --id 12 --description @notes.md'
  expect(formatCommand(command).text).toBe(command)
})

test('az true/false flags never take the next flag as their value', () => {
  expect(formatCommand('az repos pr update --id 12 --draft --org=https://dev.azure.com/other --status abandoned').text).toContain('  Org ')
  const squash = formatCommand('az repos pr update --id 12 --squash --bypass-policy --status completed')
  expect(squash.text).toContain('Bypass policy  true')
  expect(squash.head).toBe('az repos pr update 12 completed')
  expect(formatCommand('az repos pr update --id 12 --title -x').text).toBe('az repos pr update --id 12 --title -x')
})

test('an az word read from a file shows the command as written', () => {
  for (const command of ['az repos pr update --id 12 --description "see k=@~/.ssh/id_rsa"', 'az repos pr update @a 4242', 'az devops invoke --route-parameters path=@secret']) {
    expect(formatCommand(command).text).toBe(command)
  }
})

test('the az head names the action', () => {
  expect(formatCommand('az repos pr set-vote --id 12 --vote reject').head).toBe('az repos pr set-vote 12 reject')
  expect(formatCommand('az devops invoke --area git --resource pullRequestThreads --http-method POST').head).toBe('az devops invoke POST pullRequestThreads')
})
