import { expect, mock, test } from 'claude-code/testing'

import { normalizeRemote } from './register'

const CONF = [
  'gate\t^[[:space:]]*gh[[:space:]]+pr[[:space:]]+comment\tdraft-first\tThis posts a public comment.',
  'gate\t^[[:space:]]*gh[[:space:]]+pr[[:space:]]+review\tdraft-first\tThis posts a review.',
  'block\t^[[:space:]]*git[[:space:]]+commit\tcommit',
  'block-tool\t^mcp__.+__repo_pull_request_write$\tmake-pr',
  'gate-tool\t^mcp__.+__repo_pull_request_thread_write$\tdraft-first\tThis posts a comment on a pull request.',
  'gate\t^[[:space:]]*git[[:space:]]+reset[[:space:]]+--hard\tconfirm-destructive\tThis discards changes.',
  'gate\t^[[:space:]]*gh[[:space:]]+repo[[:space:]]+fork\tconfirm-external\tThis forks a repository.',
].join('\n')

// $.ui.ask is a tool.call of AskUserQuestion, answered here as the engine would.
function answerAsk(e: { questions?: readonly { question: string }[] }, label: string) {
  const question = e.questions?.[0]?.question ?? ''
  return { result: { questions: e.questions, answers: { [question]: label } } }
}

type Setup = {
  answer?: string
  ran: string[]
  asked: string[]
  logged?: string[]
  offered?: string[]
  remote?: string | null
  gitConfig?: string
  env?: string
  files?: Record<string, string>
  failing?: 'store' | 'repo' | 'cwd'
  sessionId?: string
  // Shell paths that aren't executable.
  missing?: string[]
}

function engine(on: Parameters<Parameters<typeof test>[1]>[1], setup: Setup) {
  on('fs.read', (_, e) => {
    const file = setup.files?.[e.path]
    if (file !== undefined) return { value: file }
    if (e.path.endsWith('advisor-rules.conf')) return { value: CONF }
    throw new Error('no such file')
  })
  on('process.run', (_, e) => {
    if (setup.failing === 'repo') throw new Error('git failed')
    if (e.argv[0] === 'env') {
      const env = setup.env ?? 'PATH=/bin\n'
      return { value: { exitCode: 0, stdout: e.argv[1] === '-0' ? env.split('\n').join('\0') : env, stderr: '' } }
    }
    if (e.argv[0] === 'test') return { value: { exitCode: setup.missing?.includes(e.argv[2] ?? '') === true ? 1 : 0, stdout: '', stderr: '' } }
    const remote = setup.remote === undefined ? 'git@example:me/repo.git' : setup.remote
    const stdout = setup.gitConfig ?? (remote === null ? '' : `remote.origin.url ${remote}\nremote.origin.fetch +refs/heads/*:refs/remotes/origin/*\n`)
    return { value: { exitCode: stdout === '' ? 1 : 0, stdout, stderr: '' } }
  })
  on('session.cwd', () => {
    if (setup.failing === 'cwd') throw new Error('cwd lookup failed')
    return { value: '/repo' }
  })
  on('session.id', () => ({ value: setup.sessionId ?? 's1' }))
  on('command.list', () => ({ value: [{ name: 'commit', description: '', source: 'user' }] }))
  if (setup.failing === 'store') {
    on('store.get', () => {
      throw new Error('store is down')
    })
  } else {
    mock.store(on)
  }
  on('ui.log', (_, e) => {
    setup.logged?.push(e.text)
    return { value: undefined }
  })
  on('tool.call', (_, e) => {
    if (e.tool === 'AskUserQuestion') {
      setup.asked.push(e.questions?.[0]?.question ?? '')
      setup.offered?.push(JSON.stringify(e.questions?.[0]?.options ?? []))
      if (setup.answer === undefined) return { deny: 'no one to ask' }
      return answerAsk(e, setup.answer)
    }
    setup.ran.push(e.tool === 'Bash' ? e.command : e.tool)
    return { result: {} }
  })
}

test('git commit is refused until the commit skill has loaded', async ($, on) => {
  const setup: Setup = { ran: [], asked: [] }
  engine(on, setup)

  const before = JSON.stringify(await $.tool.call({ tool: 'Bash', command: 'git commit -m x' }))
  await $.tool.call({ tool: 'Skill', skill: 'commit' })
  await $.tool.call({ tool: 'Bash', command: 'git commit -m x' })

  expect(before).toContain('`/commit`')
  expect(setup.ran).toEqual(['Skill', 'git commit -m x'])
})

test('a skill typed as a slash command counts as loaded', async ($, on) => {
  const setup: Setup = { ran: [], asked: [] }
  engine(on, setup)
  on('command.run', () => ({}))

  await $.command.run({ command: 'commit', args: '' })
  await $.tool.call({ tool: 'Bash', command: 'git commit -m x' })

  expect(setup.ran).toEqual(['git commit -m x'])
})

test('a skill the main conversation loaded does not unlock a subagent', async ($, on) => {
  const setup: Setup = { ran: [], asked: [] }
  engine(on, setup)

  await $.tool.call({ tool: 'Skill', skill: 'commit' })
  await $.tool.call({ tool: 'Bash', command: 'git commit -m x', agentId: 'a1' })

  expect(setup.ran).toEqual(['Skill'])
})

test('a gated command runs only when the person approves it', async ($, on) => {
  const setup: Setup = { answer: "Don't run", ran: [], asked: [], logged: [] }
  engine(on, setup)

  const refused = JSON.stringify(await $.tool.call({ tool: 'Bash', command: 'gh pr comment 1 --body "hi"' }))
  setup.answer = 'Run it'
  await $.tool.call({ tool: 'Bash', command: 'gh pr comment 1 --body "hi"' })

  expect(refused).toContain('did not approve')
  expect(setup.logged?.join('\n')).toContain('gh pr comment\n  PR  1\n  Body\n  │ hi')
  expect(setup.ran).toEqual(['gh pr comment 1 --body "hi"'])
})

test('text typed under Other reaches the model as the instruction', async ($, on) => {
  const setup: Setup = { answer: 'Fine, but drop the second paragraph first', ran: [], asked: [] }
  engine(on, setup)

  const out = JSON.stringify(await $.tool.call({ tool: 'Bash', command: 'gh pr comment 1 --body "hi"' }))

  expect(out).toContain('drop the second paragraph first')
  expect(out).not.toContain('did not approve')
  expect(setup.ran).toEqual([])
})

test('a skill installed through the agents plugin unlocks its rule', async ($, on) => {
  const ran: string[] = []
  on('fs.read', () => ({ value: CONF }))
  on('command.list', () => ({ value: [{ name: 'agents:commit', description: '', source: 'plugin', plugin: 'agents' }] }))
  on('command.run', () => ({}))
  on('tool.call', (_, e) => {
    ran.push(e.tool === 'Bash' ? e.command : e.tool)
    return { result: {} }
  })

  await $.tool.call({ tool: 'Skill', skill: 'commit' })
  await $.tool.call({ tool: 'Bash', command: 'git commit -m x' })

  expect(ran).toEqual(['Skill', 'git commit -m x'])
})

test('a gate with nobody to ask is refused', async ($, on) => {
  const setup: Setup = { ran: [], asked: [] }
  engine(on, setup)

  const out = JSON.stringify(await $.tool.call({ tool: 'Bash', command: 'gh pr comment 1 --body "hi"' }))

  expect(out).toContain('nobody was here to answer it')
  expect(setup.ran).toEqual([])
})

test('MCP tools follow the tool rules', async ($, on) => {
  const setup: Setup = { answer: 'Run it', ran: [], asked: [] }
  engine(on, setup)

  const blocked = JSON.stringify(await $.tool.call({ tool: 'mcp__ado__repo_pull_request_write', title: 't' }))
  await $.tool.call({ tool: 'mcp__ado__repo_pull_request_thread_write', content: 'c' })

  expect(blocked).toContain('`/make-pr`')
  expect(setup.asked.length).toBe(1)
  expect(setup.ran).toEqual(['mcp__ado__repo_pull_request_thread_write'])
})

test('a refused or unknown Skill call does not unlock anything', async ($, on) => {
  const ran: string[] = []
  on('fs.read', () => ({ value: CONF }))
  on('command.list', () => ({ value: [{ name: 'commit', description: '', source: 'user' }] }))
  on('tool.call', (_, e) => {
    if (e.tool === 'Skill') return { result: 'Error: refused', text: 'refused', isError: true }
    ran.push(e.tool === 'Bash' ? e.command : e.tool)
    return { result: {} }
  })

  await $.tool.call({ tool: 'Skill', skill: 'commit' })
  await $.tool.call({ tool: 'Bash', command: 'git commit -m x' })

  expect(ran).toEqual([])
})

test('a skill name the session does not know does not count', async ($, on) => {
  const setup: Setup = { ran: [], asked: [] }
  engine(on, setup)

  await $.tool.call({ tool: 'Skill', skill: 'nope:commitx' })
  await $.tool.call({ tool: 'Bash', command: 'git commit -m x' })

  expect(setup.ran).toEqual(['Skill'])
})

test("another plugin's skill with the same name does not unlock the rule", async ($, on) => {
  const ran: string[] = []
  on('fs.read', () => ({ value: CONF }))
  on('command.list', () => ({ value: [{ name: 'other:commit', description: '', source: 'plugin', plugin: 'other' }] }))
  on('tool.call', (_, e) => {
    ran.push(e.tool === 'Bash' ? e.command : e.tool)
    return { result: {} }
  })

  await $.tool.call({ tool: 'Skill', skill: 'other:commit' })
  await $.tool.call({ tool: 'Bash', command: 'git commit -m x' })

  expect(ran).toEqual(['Skill'])
})

test('a command no rule matches runs untouched', async ($, on) => {
  const setup: Setup = { ran: [], asked: [] }
  engine(on, setup)

  await $.tool.call({ tool: 'Bash', command: 'git status' })

  expect(setup.ran).toEqual(['git status'])
})

test('always allow stops asking for that rule in this project only', async ($, on) => {
  const setup: Setup = { answer: 'Always allow in this project', ran: [], asked: [] }
  engine(on, setup)

  await $.tool.call({ tool: 'Bash', command: 'gh pr comment 1 --body "a"' })
  setup.answer = "Don't run"
  await $.tool.call({ tool: 'Bash', command: 'gh pr comment 2 --body "b"' })
  setup.remote = 'git@example:me/other.git'
  await $.tool.call({ tool: 'Bash', command: 'gh pr comment 3 --body "c"' })

  expect(setup.asked.length).toBe(2)
  expect(setup.ran).toEqual(['gh pr comment 1 --body "a"', 'gh pr comment 2 --body "b"'])
})

test('an ssh and an https clone of one repo share their allows', async ($, on) => {
  const setup: Setup = { answer: 'Always allow in this project', ran: [], asked: [], remote: 'git@github.com:Me/Repo.git' }
  engine(on, setup)

  await $.tool.call({ tool: 'Bash', command: 'gh pr comment 1 --body "a"' })
  setup.remote = 'https://user:secret@github.com/me/repo'
  await $.tool.call({ tool: 'Bash', command: 'gh pr comment 2 --body "b"' })
  const listed = JSON.stringify(await $.command.run({ command: 'gates', args: '' }))

  expect(setup.asked.length).toBe(1)
  expect(listed).toContain('github.com/me/repo')
  expect(listed).not.toContain('secret')
})

test('a command aimed at another repo is not covered by always allow', async ($, on) => {
  const setup: Setup = { answer: 'Always allow in this project', ran: [], asked: [], offered: [] }
  engine(on, setup)

  await $.tool.call({ tool: 'Bash', command: 'gh pr comment 1 --body "a"' })
  setup.answer = "Don't run"
  const elsewhere = [
    'gh pr comment 2 -R someone/else --body "b"',
    'gh pr comment 2 -Rsomeone/else --body "b"',
    'gh pr comment https://github.com/someone/else/pull/2 --body "b"',
    'GH_REPO=someone/else gh pr comment 2 --body "b"',
    'cd ../else && gh pr comment 3 --body "c"',
    '"cd" ../else && gh pr comment 3 --body "c"',
    '\\cd ../else && gh pr comment 3 --body "c"',
    'gh pr comment 1 --body "$(cd ../else && gh pr comment 9 --body x)"',
    'gh pr comment 1 --body `cd ../else; gh pr comment 9 --body x`',
    'gh pr comment 2 "-R" someone/else --body "b"',
    "gh pr comment 2 '--repo' someone/else --body b",
    'gh pr comment 2 -\\R someone/else --body b',
    'gh pr comment 2 ${X:--R} someone/else --body b',
    'GIT_CONFIG_COUNT=1 gh pr comment 2 --body b',
    'env GH_REPO=x/y gh pr comment 2 --body b',
  ]
  for (const command of elsewhere) await $.tool.call({ tool: 'Bash', command })

  expect(setup.asked.length).toBe(1 + elsewhere.length)
  expect(setup.offered?.[1]).not.toContain('Always')
  expect(setup.ran).toEqual(['gh pr comment 1 --body "a"'])
})

test('destructive gates never offer always allow', async ($, on) => {
  const setup: Setup = { answer: "Don't run", ran: [], asked: [], offered: [] }
  engine(on, setup)

  await $.tool.call({ tool: 'Bash', command: 'git reset --hard' })

  expect(setup.offered?.[0]).not.toContain('Always')
})

test('an MCP allow covers only the Azure DevOps repo it was given for', async ($, on) => {
  const setup: Setup = { answer: 'Always allow in this project', ran: [], asked: [], offered: [] }
  engine(on, setup)
  const tool = 'mcp__ado__repo_pull_request_thread_write'

  await $.tool.call({ tool, project: 'P', repositoryId: 'web', content: 'a' })
  setup.answer = "Don't run"
  await $.tool.call({ tool, project: 'P', repositoryId: 'web', content: 'b' })
  await $.tool.call({ tool, project: 'P', repositoryId: 'api', content: 'c' })
  await $.tool.call({ tool, content: 'd' })

  expect(setup.asked.length).toBe(3)
  expect(setup.offered?.[2]).not.toContain('Always')
  expect(setup.ran).toEqual([tool, tool])
})

test('/gates reset makes every gate ask again', async ($, on) => {
  const setup: Setup = { answer: 'Always allow in this project', ran: [], asked: [] }
  engine(on, setup)

  await $.tool.call({ tool: 'Bash', command: 'gh pr comment 1 --body "a"' })
  const before = JSON.stringify(await $.command.run({ command: 'gates', args: '' }))
  await $.command.run({ command: 'gates', args: 'reset' })
  const after = JSON.stringify(await $.command.run({ command: 'gates', args: '' }))
  await $.tool.call({ tool: 'Bash', command: 'gh pr comment 2 --body "b"' })

  expect(before).toContain('This posts a public comment.')
  expect(after).toContain('no gates are always allowed')
  expect(setup.asked.length).toBe(2)
})

test('a body file is shown, unless its location depends on an earlier cd', async ($, on) => {
  const setup: Setup = { answer: "Don't run", ran: [], asked: [], logged: [], files: { '/repo/body.md': 'ROOT BODY' } }
  engine(on, setup)

  await $.tool.call({ tool: 'Bash', command: 'gh pr comment 1 --body-file=body.md' })
  await $.tool.call({ tool: 'Bash', command: 'cd sub && gh pr comment 1 -F body.md' })

  expect(setup.logged?.[0]).toContain('ROOT BODY')
  expect(setup.logged?.[1]).not.toContain('ROOT BODY')
  expect(setup.logged?.[1]).toContain('not read')
})

test('a failing store still asks', async ($, on) => {
  const setup: Setup = { answer: "Don't run", ran: [], asked: [], failing: 'store' }
  engine(on, setup)

  await $.tool.call({ tool: 'Bash', command: 'gh pr comment 1 --body "a"' })

  expect(setup.asked.length).toBe(1)
  expect(setup.ran).toEqual([])
})

test('a failing repo lookup still asks, without always allow', async ($, on) => {
  const setup: Setup = { answer: "Don't run", ran: [], asked: [], offered: [], failing: 'repo' }
  engine(on, setup)

  await $.tool.call({ tool: 'Bash', command: 'gh pr comment 1 --body "a"' })

  expect(setup.asked.length).toBe(1)
  expect(setup.offered?.[0]).not.toContain('Always')
  expect(setup.ran).toEqual([])
})

test('always allow is offered only where gh can only mean one repo', async ($, on) => {
  const setup: Setup = { answer: "Don't run", ran: [], asked: [], offered: [], remote: null }
  engine(on, setup)
  const command = 'gh pr comment 1 --body "a"'

  await $.tool.call({ tool: 'Bash', command })
  setup.gitConfig = 'remote.origin.url git@github.com:me/fork.git\nremote.upstream.url git@github.com:them/repo.git\n'
  await $.tool.call({ tool: 'Bash', command })
  setup.gitConfig = 'remote.origin.url git@github.com:me/repo.git\nremote.origin.gh-resolved base\n'
  await $.tool.call({ tool: 'Bash', command })

  expect(setup.offered?.every(o => !o.includes('Always'))).toBe(true)
})

test('gh steered by Claude Code\'s own environment gets no always allow', async ($, on) => {
  const setup: Setup = { answer: "Don't run", ran: [], asked: [], offered: [], env: 'GH_REPO=someone/else\n' }
  engine(on, setup)

  await $.tool.call({ tool: 'Bash', command: 'gh pr comment 1 --body "a"' })

  expect(setup.offered?.[0]).not.toContain('Always')
})

test('a call run through always allow is still logged', async ($, on) => {
  const setup: Setup = { answer: 'Always allow in this project', ran: [], asked: [], logged: [] }
  engine(on, setup)

  await $.tool.call({ tool: 'Bash', command: 'gh pr comment 1 --body "a"' })
  await $.tool.call({ tool: 'Bash', command: 'gh pr comment 2 --body "b"' })

  expect(setup.logged?.[1]).toContain('│ b')
})

test('a command substitution in the body still gets always allow', async ($, on) => {
  const setup: Setup = { answer: "Don't run", ran: [], asked: [], offered: [] }
  engine(on, setup)

  await $.tool.call({ tool: 'Bash', command: 'gh pr comment 1 --body "$(cat notes.md)"' })

  expect(setup.offered?.[0]).toContain('Always')
})

test('forks never offer always allow', async ($, on) => {
  const setup: Setup = { answer: "Don't run", ran: [], asked: [], offered: [] }
  engine(on, setup)

  await $.tool.call({ tool: 'Bash', command: 'gh repo fork --clone=false someone/else' })

  expect(setup.offered?.[0]).not.toContain('Always')
})

test('remote URLs normalize to one key per repo', () => {
  expect(normalizeRemote('git@github.com:1234/repo.git')).toBe('github.com/1234/repo')
  expect(normalizeRemote('ssh://git@github.com:22/me/repo.git')).toBe('github.com/me/repo')
  expect(normalizeRemote('git@gitlab.com:group/sub/repo.git')).toBe('gitlab.com/group/sub/repo')
  expect(normalizeRemote('https://user:secret@github.com/Me/Repo/')).toBe('github.com/me/repo')
})

test('azure devops ssh and https remotes normalize to the same key', () => {
  expect(normalizeRemote('git@ssh.dev.azure.com:v3/Org/Proj/Repo')).toBe(normalizeRemote('https://org@dev.azure.com/org/proj/_git/repo'))
})

test('a policy bypass through MCP never offers always allow', async ($, on) => {
  const setup: Setup = { answer: "Don't run", ran: [], asked: [], offered: [] }
  engine(on, setup)

  await $.tool.call({ tool: 'mcp__ado__repo_pull_request_thread_write', project: 'P', repositoryId: 'web', bypassPolicy: true })

  expect(setup.offered?.[0]).not.toContain('Always')
})

test('a failing cwd lookup still shows the dialog', async ($, on) => {
  const setup: Setup = { answer: "Don't run", ran: [], asked: [], logged: [], failing: 'cwd' }
  engine(on, setup)

  await $.tool.call({ tool: 'Bash', command: 'gh pr comment 1 -F body.md' })

  expect(setup.logged?.[0]).toContain('could not be read')
  expect(setup.ran).toEqual([])
})

test('the full command is shown in the transcript before the dialog', async ($, on) => {
  const setup: Setup = { answer: "Don't run", ran: [], asked: [], logged: [] }
  engine(on, setup)

  await $.tool.call({ tool: 'Bash', command: 'gh pr comment 1 --body "the full body text"' })

  expect(setup.logged?.join('\n')).toContain('the full body text')
  expect(setup.asked[0]).toContain('shown above')
})

test('allow for this session skips the dialog until reset, and is never stored', async ($, on) => {
  const setup: Setup = { answer: 'Allow for this session', ran: [], asked: [], offered: [] }
  engine(on, setup)

  await $.tool.call({ tool: 'Bash', command: 'gh pr comment 1 --body "a"' })
  await $.tool.call({ tool: 'Bash', command: 'gh pr comment 2 --body "b"' })
  const listed = JSON.stringify(await $.command.run({ command: 'gates', args: '' }))
  await $.command.run({ command: 'gates', args: 'reset' })
  setup.answer = "Don't run"
  await $.tool.call({ tool: 'Bash', command: 'gh pr comment 3 --body "c"' })

  expect(setup.offered?.[0]).toContain('Allow for this session')
  expect(setup.asked.length).toBe(2)
  expect(setup.ran).toEqual(['gh pr comment 1 --body "a"', 'gh pr comment 2 --body "b"'])
  expect(listed).toContain('allowed for this session')
  expect(listed).not.toContain('always allowed (')
})

test('a session allow is not offered where always allow is not', async ($, on) => {
  const setup: Setup = { answer: "Don't run", ran: [], asked: [], offered: [] }
  engine(on, setup)

  await $.tool.call({ tool: 'Bash', command: 'git reset --hard' })
  await $.tool.call({ tool: 'Bash', command: 'gh pr comment 2 -R someone/else --body "b"' })

  expect(setup.offered?.every(o => !o.includes('session'))).toBe(true)
})

test('the dialog names the call by its fields, not the raw command', async ($, on) => {
  const setup: Setup = { answer: "Don't run", ran: [], asked: [], logged: [] }
  engine(on, setup)

  await $.tool.call({ tool: 'Bash', command: "gh pr review 7 --approve --body \"$(cat <<'EOF'\nLooks good.\n\nShip it.\nEOF\n)\"" })
  await $.tool.call({ tool: 'mcp__ado__repo_pull_request_thread_write', project: 'P', repositoryId: 'web', content: 'line one\nline two' })

  expect(setup.logged?.[0]).toContain('gh pr review\n  PR      7\n  Review  Approve\n  Body\n  │ Looks good.\n  │ \n  │ Ship it.')
  expect(setup.asked[0]).toContain('`gh pr review 7`')
  expect(setup.logged?.[1]).toContain('ado repo_pull_request_thread_write\n  project       P\n  repositoryId  web\n  content\n  │ line one\n  │ line two')
})

test('a body file is read from the exact path gh gets', async ($, on) => {
  const setup: Setup = { answer: "Don't run", ran: [], asked: [], logged: [], files: { '/repo/ab.md': 'REAL', '/repo/a': 'DECOY' } }
  engine(on, setup)

  await $.tool.call({ tool: 'Bash', command: 'gh pr comment 1 --body-file "a"b.md' })

  expect(setup.logged?.[0]).toContain('REAL')
  expect(setup.logged?.[0]).not.toContain('DECOY')
})

test('a session allow does not reach another session', async ($, on) => {
  const setup: Setup = { answer: 'Allow for this session', ran: [], asked: [] }
  engine(on, setup)

  await $.tool.call({ tool: 'Bash', command: 'gh pr comment 1 --body "a"' })
  setup.sessionId = 's2'
  setup.answer = "Don't run"
  await $.tool.call({ tool: 'Bash', command: 'gh pr comment 2 --body "b"' })
  setup.sessionId = 's1'
  await $.command.run({ command: 'gates', args: 'reset' })

  expect(setup.asked.length).toBe(2)
})

test('the shell the Bash tool uses decides how a heredoc body is read', async ($, on) => {
  const setup: Setup = { answer: "Don't run", ran: [], asked: [], logged: [], env: 'SHELL=/bin/zsh\n' }
  engine(on, setup)
  const command = "gh pr comment 1 --body \"$(cat <<'EOF'\nIt's done\nEOF\n)\""

  await $.tool.call({ tool: 'Bash', command })
  setup.env = 'SHELL=/bin/zsh\nCLAUDE_CODE_SHELL=/bin/bash\n'
  await $.tool.call({ tool: 'Bash', command })
  setup.env = 'SHELL=/bin/bash\nCLAUDE_CODE_SHELL=/opt/missing/zsh\n'
  setup.missing = ['/opt/missing/zsh']
  await $.tool.call({ tool: 'Bash', command })
  setup.env = 'X=a\nCLAUDE_CODE_SHELL=/bin/zsh\nSHELL=/bin/bash\n'
  setup.missing = []
  await $.tool.call({ tool: 'Bash', command })

  expect(setup.logged?.[0]).toContain("│ It's done")
  expect(setup.logged?.[1]).toContain(command)
  expect(setup.logged?.[2]).toContain(command)
  expect(setup.logged?.[3]).toContain("│ It's done")
  setup.env = 'CLAUDE_CODE_SHELL=bash\nSHELL=/bin/zsh\n'
  await $.tool.call({ tool: 'Bash', command })
  expect(setup.logged?.[4]).toContain(command)
})
