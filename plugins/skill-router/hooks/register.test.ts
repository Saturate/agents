import { expect, test } from 'claude-code/testing'

const CONF = [
  'gate\t^[[:space:]]*gh[[:space:]]+pr[[:space:]]+comment\tdraft-first\tThis posts a public comment.',
  'block\t^[[:space:]]*git[[:space:]]+commit\tcommit',
  'block-tool\t^mcp__.+__repo_pull_request_write$\tmake-pr',
  'gate-tool\t^mcp__.+__repo_pull_request_thread_write$\tdraft-first\tThis posts a comment on a pull request.',
].join('\n')

// $.ui.ask is a tool.call of AskUserQuestion, answered here as the engine would.
function answerAsk(e: { questions?: readonly { question: string }[] }, label: string) {
  const question = e.questions?.[0]?.question ?? ''
  return { result: { questions: e.questions, answers: { [question]: label } } }
}

type Setup = { answer?: string; ran: string[]; asked: string[] }

function engine(on: Parameters<Parameters<typeof test>[1]>[1], setup: Setup) {
  on('fs.read', () => ({ value: CONF }))
  on('command.list', () => ({ value: [{ name: 'commit', description: '', source: 'user' }] }))
  on('tool.call', (_, e) => {
    if (e.tool === 'AskUserQuestion') {
      setup.asked.push(e.questions?.[0]?.question ?? '')
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
  const setup: Setup = { answer: "Don't run", ran: [], asked: [] }
  engine(on, setup)

  const refused = JSON.stringify(await $.tool.call({ tool: 'Bash', command: 'gh pr comment 1 --body "hi"' }))
  setup.answer = 'Run it'
  await $.tool.call({ tool: 'Bash', command: 'gh pr comment 1 --body "hi"' })

  expect(refused).toContain('did not approve')
  expect(setup.asked[0]).toContain('gh pr comment 1 --body "hi"')
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
