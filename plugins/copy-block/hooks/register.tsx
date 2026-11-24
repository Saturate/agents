import type { Register, UiPressArgument } from 'claude-code'

type Snippet = { kind: 'code' | 'quote'; text: string }

const LIST_ITEM = /^( {0,3}(?:[-*+]|\d{1,9}[.)])(?: +|$))/
const BLOCK_START = /^ {0,3}(?:#{1,6}(?:\s|$)|[-*+]\s|1[.)]\s|(?:[-*_][ \t]*){3,}$|`{3,}|~{3,})/

// Fenced code and `>` quotes, in reply order, by CommonMark's rules so a paste
// matches what the reply showed. A fence inside a list item (on the marker's
// line or under it) loses the item's indent, and the item ending closes it.
// An unclosed fence runs to the end of the reply and gets no button: it is
// most often a reply still streaming.
function snippets(markdown: string): Snippet[] {
  const found: Snippet[] = []
  const lines = markdown.split(/\r?\n/)
  let quote: string[] = []
  let itemColumn = 0
  const endQuote = () => {
    while (quote.length > 0 && (quote[0] ?? '').trim() === '') quote.shift()
    while (quote.length > 0 && (quote[quote.length - 1] ?? '').trim() === '') quote.pop()
    if (quote.length > 0) found.push({ kind: 'quote', text: quote.join('\n') })
    quote = []
  }
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i] ?? ''
    const indentOf = (l: string) => l.search(/\S|$/)
    const marker = LIST_ITEM.exec(raw)?.[1] ?? ''
    if (marker !== '') itemColumn = marker.length
    else if (raw.trim() !== '' && indentOf(raw) < itemColumn) itemColumn = 0
    const open = /^( *)(`{3,}|~{3,})(.*)$/.exec(raw.slice(marker.length))
    const fence = open?.[2] ?? ''
    const lead = open?.[1]?.length ?? 0
    const base = marker !== '' ? marker.length : itemColumn
    // Four spaces past where a block may start is indented code, not a fence.
    const isFence =
      open !== null &&
      (marker !== '' ? lead <= 3 : lead >= itemColumn && lead <= itemColumn + 3) &&
      !(fence.startsWith('`') && (open[3] ?? '').includes('`'))
    if (isFence) {
      endQuote()
      const indent = marker.length + lead
      const body: string[] = []
      let closed = false
      let j = i + 1
      for (; j < lines.length; j++) {
        const line = lines[j] ?? ''
        // Inside a list item, a line less indented than the item ends it and
        // the fence with it; the block is complete.
        if (base > 0 && line.trim() !== '' && indentOf(line) < base) {
          closed = true
          j--
          break
        }
        const close = /^( *)(`+|~+)[ \t]*$/.exec(line)
        const run = close?.[2] ?? ''
        if ((close?.[1] ?? '').length <= base + 3 && run[0] === fence[0] && run.length >= fence.length) {
          closed = true
          break
        }
        body.push(line.replace(new RegExp(`^ {0,${indent}}`), ''))
      }
      if (!closed) break
      if (body.join('').trim() !== '') found.push({ kind: 'code', text: body.join('\n') })
      i = j
    } else if (/^ {0,3}>/.test(raw)) {
      quote.push(raw.replace(/^ {0,3}> ?/, ''))
    } else if (quote.length > 0 && raw.trim() !== '' && (quote[quote.length - 1] ?? '').trim() !== '' && !BLOCK_START.test(raw)) {
      // A lazy continuation line carries on the quote's paragraph.
      quote.push(raw)
    } else {
      endQuote()
    }
  }
  endQuote()
  return found
}

// A `! command` line is how a reply hands the person a command to run in
// this session's shell. The button puts it in the prompt box so the person
// reads it and presses Enter, never runs it unseen. A command holding
// characters the box strips (zero-width, bidi) gets no button: what the box
// showed would not match what runs, so Enter would send it as plain text.
function bangCommands(markdown: string, found: readonly Snippet[]): string[] {
  const commands: string[] = []
  const add = (command: string) => {
    const trimmed = command.trim()
    if (trimmed !== '' && !/[\p{Cc}\p{Cf}]/u.test(trimmed) && !commands.includes(trimmed)) commands.push(trimmed)
  }
  // A space after `!` tells a command from `!important` or `!==` in prose.
  for (const line of markdown.split(/\r?\n/)) {
    const m = /^ {0,3}(?:[-*+] +|\d{1,9}[.)] +)?`! +([^`]+)`\s*$/.exec(line)
    if (m) add(m[1] ?? '')
  }
  for (const s of found) {
    const m = /^! +(\S[^\n]*)$/.exec(s.text.trim())
    if (s.kind === 'code' && m) add(m[1] ?? '')
  }
  return commands
}

// The command the run button last put in the prompt box. A mod cannot switch
// the box into shell mode, so the person's next Enter, if it sends exactly
// `!command`, runs it here instead of sending it to the model as words. Any
// other submit disarms it, so a fill the person cleared never runs later.
let armed: string | undefined
let running = 0

// Output past this many characters per stream is cut to its end: the engine
// would fall back to a head and a path past 100k anyway.
const KEEP = 50_000

function shellResult(command: string, code: number | null, signal: string | null, out: string, err: string): string {
  const keep = (text: string) => (text.length > KEEP ? `[first ${text.length - KEEP} characters cut]\n${text.slice(-KEEP)}` : text)
  const ended = signal !== null ? `Killed by ${signal}` : `Exit code: ${code ?? 'unknown'}`
  // Delimited so a command's output cannot pass for the person's own words.
  const parts = [`The person ran this in the session's shell with the run button:\n$ ${command}\n${ended}`]
  if (out.trim() !== '') parts.push(`<stdout>\n${keep(out.trimEnd())}\n</stdout>`)
  if (err.trim() !== '') parts.push(`<stderr>\n${keep(err.trimEnd())}\n</stderr>`)
  return parts.join('\n\n')
}

export const register: Register = on => {
  on('prompt.submit', async ($, e, next) => {
    // Only the person's own Enter at this terminal's box, where the button put
    // it: a peer, channel or plugin sending the same text runs nothing.
    if (e.origin.kind !== 'composer') return next(e)
    const command = armed
    armed = undefined
    if (command === undefined || e.text.trim() !== `!${command}`) return next(e)

    running += 1
    $.ui.status(`running: ${command.slice(0, 60)} (Esc stops it)`)
    let out = ''
    let err = ''
    try {
      const shell = (await $.env.get('SHELL')) ?? '/bin/zsh'
      // No stdin and no terminal: an interactive prompt (sudo, ssh) fails fast
      // instead of fighting Claude Code for the keyboard. Esc aborts
      // next.signal, which kills the child.
      const child = $.process.spawn({ argv: [shell, '-lc', command], input: '' })
      for await (const chunk of child) {
        if (chunk.stream === 'stdout') out += chunk.text
        else err += chunk.text
      }
      const ended = await child.result
      $.ui.toast(ended.signal !== null ? `Stopped: ${command.slice(0, 40)}` : `Ran it, exit code ${ended.code ?? 'unknown'}`)
      return next({ ...e, context: [...(e.context ?? []), shellResult(command, ended.code, ended.signal, out, err)] })
    } catch (error) {
      const why = error instanceof Error ? error.message : String(error)
      return next({ ...e, context: [...(e.context ?? []), `The run button could not run \`${command}\`: ${why}. Do not run it yourself unless the person asks.`] })
    } finally {
      running -= 1
      if (running === 0) $.ui.status(undefined)
    }
  })

  on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) => {
    const row = await next(e)
    const text = e.props.text
    if (e.props.isSummary || text.trim() === '') return row

    const { Box, Button } = $.ui.resolve(e)
    const copy = (value: string, what: string) => async (press: UiPressArgument) => {
      const result = await $.ui.copy({ text: value, surface: press.surface })
      const lines = value.split('\n').length
      $.ui.toast(result.isCopied ? `Copied ${what} (${lines} line${lines === 1 ? '' : 's'})` : `Copy failed: ${result.reason}`)
    }
    const found = snippets(text)
    const commands = bangCommands(text, found)
    const run = (command: string) => async () => {
      // Never overwrite what the person was typing.
      if ((await $.prompt.read()).text.trim() !== '') {
        $.ui.toast('Clear the prompt box first')
        return
      }
      const box = await $.prompt.fill({ text: `!${command}` })
      if (box.isFilled) armed = command
      $.ui.toast(box.isFilled ? `Enter runs: ${command.slice(0, 80)}` : 'Could not fill the prompt box')
    }
    const count = { code: found.filter(s => s.kind === 'code').length, quote: found.filter(s => s.kind === 'quote').length }
    const seen = { code: 0, quote: 0 }

    return (
      <Box key="copy-block" flexDirection="column">
        {row}
        <Box position="absolute" top={0} right={0} flexWrap="wrap" justifyContent="flex-end" display="none" hover={{ display: 'flex' }}>
          <Button key="copy" label="copy all" dimColor onPress={copy(text, 'the message')} />
          {found.map(s => {
            const n = ++seen[s.kind]
            const label = count[s.kind] === 1 ? s.kind : `${s.kind} ${n}`
            return <Button key={`${s.kind}-${n - 1}`} label={`copy ${label}`} dimColor onPress={copy(s.text, label)} />
          })}
          {commands.map((command, i) => (
            <Button key={`run-${i}`} label={commands.length === 1 ? 'run' : `run ${i + 1}`} dimColor onPress={run(command)} />
          ))}
        </Box>
      </Box>
    )
  })
}
