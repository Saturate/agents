import { expect, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

const TEXT = 'Run this:\n\n```sh\nnpm test\n```\n\nThen:\n\n~~~\nls -la\n~~~\n\nUnfinished:\n\n```\nhalf'

const reply = (text: string, isSummary?: true) =>
  ({
    plugin: 'copy-block',
    component: 'AssistantMessage',
    surface: 'terminal',
    props: { text, isFirstOfReply: true, ...(isSummary ? { isSummary } : {}) },
  }) as const

test('copy and per-block buttons put the right text on the clipboard', async ($, on) => {
  const copied: string[] = []
  on('ui.copy', (_, e) => {
    copied.push(e.text)
    return { value: { isCopied: true } }
  })
  on('ui.toast', () => ({ value: undefined }))
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine row</Text>
  })

  const ui = await $.ui.mount(reply(TEXT))
  expect((await ui.find({ type: 'Text', text: /engine row/ }))?.text).toBe('engine row')
  const buttons = await ui.findAll({ type: 'Button' })
  expect(buttons.map(b => b.key)).toEqual(['copy', 'code-0', 'code-1'])

  await ui.press({ key: 'copy' })
  await ui.press({ key: 'code-0' })
  await ui.press({ key: 'code-1' })
  expect(copied).toEqual([TEXT, 'npm test', 'ls -la'])
  await ui.unmount()
})

test('a quote gets its own button, without the > markers', async ($, on) => {
  const copied: string[] = []
  on('ui.copy', (_, e) => {
    copied.push(e.text)
    return { value: { isCopied: true } }
  })
  on('ui.toast', () => ({ value: undefined }))
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine row</Text>
  })
  const quoted = 'Here is the text:\n\n> First paragraph.\n>\n> Second line.\n\n```\n> not a quote\n```'
  const ui = await $.ui.mount(reply(quoted))
  expect((await ui.findAll({ type: 'Button' })).map(b => b.key)).toEqual(['copy', 'quote-0', 'code-0'])
  await ui.press({ key: 'quote-0' })
  await ui.press({ key: 'code-0' })
  expect(copied).toEqual(['First paragraph.\n\nSecond line.', '> not a quote'])
  await ui.unmount()
})

const cases: Array<[string, string, string[]]> = [
  ['a fence in a list item loses the item indent', '1. Install:\n   ```python\n   def f():\n       return 1\n   ```\n', ['def f():\n    return 1']],
  ['a closer longer than its opener closes it', '```\na\n````\n\nprose\n\n```sh\nls\n```', ['a', 'ls']],
  ['a closer less indented than its opener closes it at top level', '  ```sh\n  ls\n```\n\n> quote after', ['ls', 'quote after']],
  ['a line left of a list item ends the item and its fence', '- step\n  ```sh\n  ls\n```\n\n> quote after', ['ls']],
  ['a fence on the list marker line', '- ```sh\n  ls\n  ```\n\ntext\n\n```py\nx\n```\n', ['ls', 'x']],
  ['a fence four spaces in outside a list is indented code', 'para\n\n    ```\n    x\n    ```\n\n> q\n\n```\nreal\n```', ['q', 'real']],
  ['a heading after a quote ends it', '> quote\n# Heading', ['quote']],
  ['a list after a quote ends it', '> quote\n- item', ['quote']],
  ['a lazy line only follows quote text', '> a\n>\nb', ['a']],
  ['blank-looking lines at a quote edge are dropped', '> a\n>  \n', ['a']],
  ['a backtick in the info string is no fence', '```foo``` is inline\n\n> keep me', ['keep me']],
  ['CRLF line ends', '```\r\nx\r\n```\r\n', ['x']],
  ['a lazy line continues the quote', '> line one\nline two\n\nafter', ['line one\nline two']],
  ['four spaces before > is no quote', '    > not a quote', []],
  ['an unclosed fence gets no button', 'text\n\n```sh\nhalf', []],
  ['an empty code block gets no button', '```\n```', []],
]

for (const [name, markdown, expected] of cases) {
  test(name, async ($, on) => {
    const copied: string[] = []
    on('ui.copy', (_, e) => {
      copied.push(e.text)
      return { value: { isCopied: true } }
    })
    on('ui.toast', () => ({ value: undefined }))
    on('ui.render', ($, e) => {
      const { Text } = $.ui.resolve(e)
      return <Text>engine row</Text>
    })
    const ui = await $.ui.mount(reply(markdown))
    for (const button of await ui.findAll({ type: 'Button' })) {
      if (button.key !== 'copy' && button.key !== undefined) await ui.press({ key: button.key })
    }
    expect(copied).toEqual(expected)
    await ui.unmount()
  })
}

test('labels number blocks of a kind and the toast counts lines', async ($, on) => {
  const toasts: string[] = []
  on('ui.copy', () => ({ value: { isCopied: true } }))
  on('ui.toast', (_, e) => {
    toasts.push(String(e.text))
    return { value: undefined }
  })
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine row</Text>
  })
  const ui = await $.ui.mount(reply('> one\n\n```\na\nb\n```\n\n> two'))
  const buttons = await ui.findAll({ type: 'Button' })
  expect(buttons.map(b => b.text)).toEqual(['copy all', 'copy quote 1', 'copy code', 'copy quote 2'])
  await ui.press({ key: 'code-0' })
  await ui.press({ key: 'quote-1' })
  expect(toasts).toEqual(['Copied code (2 lines)', 'Copied quote 2 (1 line)'])
  await ui.unmount()
})

test('a failed copy says why', async ($, on) => {
  const toasts: string[] = []
  on('ui.copy', () => ({ value: { isCopied: false, reason: 'no-clipboard' } }))
  on('ui.toast', (_, e) => {
    toasts.push(String(e.text))
    return { value: undefined }
  })
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine row</Text>
  })
  const ui = await $.ui.mount(reply('hello'))
  await ui.press({ key: 'copy' })
  expect(toasts).toEqual(['Copy failed: no-clipboard'])
  await ui.unmount()
})

test('a summary row is left alone', async ($, on) => {
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine row</Text>
  })
  const ui = await $.ui.mount(reply('a summary', true))
  expect(await ui.findAll({ type: 'Button' })).toHaveLength(0)
  await ui.unmount()
})

function runHarness(on: Parameters<TestBody>[1], box = '') {
  const fills: string[] = []
  const ran: string[][] = []
  const toasts: string[] = []
  on('prompt.read', () => ({ value: { text: box, cursor: 0 } }))
  on('prompt.fill', (_, e) => {
    fills.push(e.text)
    return { isFilled: true }
  })
  on('ui.toast', (_, e) => {
    toasts.push(String(e.text))
    return { value: undefined }
  })
  on('ui.status', () => ({ value: undefined }))
  on('env.get', () => ({ value: '/bin/zsh' }))
  on('process.spawn', async function* (_, e) {
    ran.push([...e.argv])
    yield { stream: 'stdout', text: 'hi\n' }
    return { value: { code: 0, signal: null } }
  })
  on('prompt.submit', (_, e) => ({ text: e.text, context: e.context }))
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine row</Text>
  })
  return { fills, ran, toasts }
}

const typed = { origin: { kind: 'composer' }, wait: false } as const
const RUNNABLE = 'Run it:\n\n`! echo hi`\n\nor\n\n```\n! date\n```\n\nnot `!important` or `! a​b`'

test('run fills the prompt box, and Enter on it runs the command for the model', async ($, on) => {
  const h = runHarness(on)
  const ui = await $.ui.mount(reply(RUNNABLE))
  expect((await ui.findAll({ type: 'Button' })).map(b => b.text)).toEqual(['copy all', 'copy code', 'run 1', 'run 2'])
  await ui.press({ key: 'run-0' })
  expect(h.fills).toEqual(['!echo hi'])

  // The same text from anywhere but the person's composer runs nothing, and
  // does not disarm the fill.
  await $.prompt.submit({ text: '!echo hi', origin: { kind: 'sdk' }, wait: false })
  expect(h.ran).toHaveLength(0)
  const submitted = await $.prompt.submit({ text: '!echo hi', ...typed })
  expect(h.ran).toEqual([['/bin/zsh', '-lc', 'echo hi']])
  expect(submitted.context?.[0]).toContain('$ echo hi\nExit code: 0\n\n<stdout>\nhi\n</stdout>')

  // Once only.
  await $.prompt.submit({ text: '!echo hi', ...typed })
  expect(h.ran).toHaveLength(1)
  await ui.unmount()
})

test('any other submit disarms the fill', async ($, on) => {
  const h = runHarness(on)
  const ui = await $.ui.mount(reply(RUNNABLE))
  await ui.press({ key: 'run-0' })
  await $.prompt.submit({ text: 'never mind', ...typed })
  await $.prompt.submit({ text: '!echo hi', ...typed })
  expect(h.ran).toHaveLength(0)
  await ui.unmount()
})

test('run never overwrites what the person was typing', async ($, on) => {
  const h = runHarness(on, 'half a thought')
  const ui = await $.ui.mount(reply(RUNNABLE))
  await ui.press({ key: 'run-0' })
  expect(h.fills).toHaveLength(0)
  expect(h.toasts).toEqual(['Clear the prompt box first'])
  await ui.unmount()
})
