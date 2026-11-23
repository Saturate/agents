// Lays a gated call out for the person approving it: fields on their own
// lines and the text that gets posted as plain text, not a shell command.
// Anything this can't read exactly falls back to the command as written, so
// the layout never shows something other than what runs.

export type Shown = {
  // The whole layout, drawn in the transcript above the dialog.
  text: string
  // One line naming the call, for the dialog's question.
  head: string
  // The `--body-file` paths gh will read, when the words were read exactly.
  bodyFiles?: readonly string[]
  // The command (`az repos pr update`) and its fields, when read exactly.
  name?: string
  values?: Readonly<Record<string, string>>
  // How many other commands run alongside the one `head` names.
  others?: number
}

// The opener of `"$(cat <<'EOF' ... EOF)"`, how Claude passes multi-line text.
const HEREDOC_OPEN = /^\$\([ \t]*cat[ \t]+<<(-?)[ \t]*(['"]?)([A-Za-z_][A-Za-z0-9_]*)\2[ \t]*\n/

function balanced(text: string): boolean {
  let depth = 0
  for (const c of text) {
    if (c === '(') depth++
    else if (c === ')' && --depth < 0) return false
  }
  return depth === 0
}

// The text a quoted heredoc substitution at `start` produces, and its length.
// The body ends at the first line that is exactly the delimiter, as in the
// shell; anything after that line other than the closing `)` would run as
// commands, so it is not read.
function heredocSub(src: string, start: number, zsh: boolean): { text: string; length: number } | undefined {
  const open = HEREDOC_OPEN.exec(src.slice(start))
  if (!open) return undefined
  const [opener, dash = '', quote = '', delimiter = ''] = open
  const lines: string[] = []
  let at = start + opener.length
  for (;;) {
    const nl = src.indexOf('\n', at)
    if (nl === -1) return undefined
    const raw = src.slice(at, nl)
    const line = dash === '-' ? raw.replace(/^\t+/, '') : raw
    at = nl + 1
    if (line === delimiter) break
    // bash ends the heredoc early on a line that starts with the delimiter
    // and has a `)` later, and runs the rest of that line.
    if (raw.startsWith(delimiter)) return undefined
    lines.push(line)
  }
  const close = /^[ \t\n]*\)/.exec(src.slice(at))
  if (!close) return undefined
  const body = lines.join('\n')
  // An unquoted delimiter expands `$x` and backticks in the body.
  if (quote === '' && /[$`\\]/.test(body)) return undefined
  // bash 3.2 (macOS /bin/bash) closes the `$(` at the first unmatched `)` in
  // the body and runs what follows, so only balanced parentheses are read.
  if (!balanced(body)) return undefined
  // bash 3.2 also reads quotes, backslashes and `#` comments in the body when
  // it looks for that `)`, so under bash such a body is not read either. zsh
  // reads the heredoc as a heredoc.
  if (!zsh && /['"`\\#]/.test(body)) return undefined
  // A substitution drops every trailing newline of its output.
  return { text: body.replace(/\n+$/, ''), length: at + close[0].length - start }
}

// Unquoted characters whose meaning never depends on the shell. `#` is left out: it starts a comment, and with zsh's extendedglob it is a
// glob anywhere. `=` is checked apart: at the start of a word zsh expands
// `=ls` to a path, and with magicequalsubst so does `a==ls`.
const LITERAL = /[A-Za-z0-9._/@+:,%-]/

// The words a simple command passes, as the shell would pass them, or
// undefined when any of them depends on the shell at run time (a variable, a
// glob, a second command, a substitution other than a quoted heredoc).
export function shellWords(command: string, zsh = false): string[] | undefined {
  const src = command.trim()
  const words: string[] = []
  let word: string | undefined
  let i = 0
  while (i < src.length) {
    const c = src.charAt(i)
    const equals = c === '='
    // Only right after a plain character: anywhere else (word start, after
    // a quote, `=` or `:`) zsh may expand `=ls` to a path.
    if (equals && !/[A-Za-z0-9._/@+,%-]/.test(src.charAt(i - 1))) return undefined
    if (c === ' ' || c === '\t') {
      if (word !== undefined) words.push(word)
      word = undefined
      i++
    } else if (c === '\\') {
      const n = src.charAt(i + 1)
      if (n === '') return undefined
      if (n !== '\n') word = (word ?? '') + n
      i += 2
    } else if (c === "'") {
      const end = src.indexOf("'", i + 1)
      // With zsh's rcquotes, `'it''s'` is one string holding a quote.
      if (end === -1 || src.charAt(end + 1) === "'") return undefined
      word = (word ?? '') + src.slice(i + 1, end)
      i = end + 1
    } else if (c === '"') {
      const quoted = doubleQuoted(src, i + 1, zsh)
      if (quoted === undefined) return undefined
      word = (word ?? '') + quoted.text
      i = quoted.end + 1
    } else if (LITERAL.test(c) || equals) {
      word = (word ?? '') + c
      i++
    } else {
      return undefined
    }
  }
  if (word !== undefined) words.push(word)
  return words
}

function doubleQuoted(src: string, start: number, zsh: boolean): { text: string; end: number } | undefined {
  let text = ''
  let j = start
  while (j < src.length) {
    const d = src.charAt(j)
    if (d === '"') return { text, end: j }
    if (d === '`') return undefined
    if (d === '\\') {
      const n = src.charAt(j + 1)
      if (n === '\n') {
        j += 2
      } else if (n !== '' && '$`"\\'.includes(n)) {
        text += n
        j += 2
      } else {
        text += d
        j++
      }
    } else if (d === '$') {
      const sub = heredocSub(src, j, zsh)
      if (!sub) return undefined
      text += sub.text
      j += sub.length
    } else {
      text += d
      j++
    }
  }
  return undefined
}

type Spec = {
  // Value flags and the field each fills.
  values: Readonly<Record<string, string>>
  // Flags that take every following word up to the next flag (az's nargs).
  multi?: Readonly<Record<string, string>>
  // Flags without a value and what each means.
  bools: Readonly<Record<string, string>>
  // Label of the positional argument, or undefined when none is taken.
  target?: string
}

const BODY = { '--body': 'Body', '-b': 'Body', '--body-file': 'Body file', '-F': 'Body file', '--repo': 'Repo', '-R': 'Repo' }

// Arguments every az command takes.
const AZ_VALUES = { '--org': 'Org', '--organization': 'Org', '--detect': 'Detect', '--output': 'Output', '-o': 'Output', '--query': 'Query', '--subscription': 'Subscription' }
const AZ_BOOLS = { '--only-show-errors': 'Only errors', '--debug': 'Debug', '--verbose': 'Verbose' }

// gh reuses short flags per command (`-a` is --assignee for an issue and
// --approve for a review), so each command has its own table.
const SPECS: Readonly<Record<string, Spec>> = {
  'gh pr comment': {
    values: BODY,
    bools: { '--edit-last': 'Edits your last comment', '--delete-last': 'Deletes your last comment', '--create-if-none': 'Creates one if none exists', '--yes': 'Skips confirmation', '--web': 'Opens the browser', '-w': 'Opens the browser', '--editor': 'Opens an editor', '-e': 'Opens an editor' },
    target: 'PR',
  },
  'gh pr review': {
    values: BODY,
    bools: { '--approve': 'Approve', '-a': 'Approve', '--request-changes': 'Request changes', '-r': 'Request changes', '--comment': 'Comment', '-c': 'Comment' },
    target: 'PR',
  },
  'gh issue create': {
    values: { ...BODY, '--title': 'Title', '-t': 'Title', '--assignee': 'Assignees', '-a': 'Assignees', '--label': 'Labels', '-l': 'Labels', '--milestone': 'Milestone', '-m': 'Milestone', '--project': 'Project', '-p': 'Project', '--template': 'Template', '-T': 'Template' },
    bools: { '--web': 'Opens the browser', '-w': 'Opens the browser', '--editor': 'Opens an editor', '-e': 'Opens an editor' },
  },
  'az repos pr set-vote': {
    values: { ...AZ_VALUES, '--id': 'PR', '--vote': 'Vote' },
    bools: AZ_BOOLS,
  },
  'az repos pr update': {
    values: {
      ...AZ_VALUES,
      '--id': 'PR',
      '--title': 'Title',
      '--status': 'Status',
      '--draft': 'Draft',
      '--auto-complete': 'Auto-complete',
      '--squash': 'Squash',
      '--delete-source-branch': 'Delete source branch',
      '--merge-commit-message': 'Merge message',
      '--transition-work-items': 'Transition work items',
      '--bypass-policy': 'Bypass policy',
      '--bypass-policy-reason': 'Bypass reason',
    },
    // az joins the words of a description with newlines.
    multi: { '--description': 'Description', '-d': 'Description' },
    bools: AZ_BOOLS,
  },
  'az devops invoke': {
    values: { ...AZ_VALUES, '--area': 'Area', '--resource': 'Resource', '--http-method': 'Method', '--api-version': 'API version', '--in-file': 'Body file', '--out-file': 'Out file', '--media-type': 'Media type', '--accept-media-type': 'Accept' },
    multi: { '--route-parameters': 'Route', '--query-parameters': 'Query parameters' },
    bools: AZ_BOOLS,
  },
}

const BLOCKS = new Set(['Body', 'Description'])

// az's true/false flags (nargs '?'): bare they mean true, and they take the
// next word only when it isn't a flag.
const AZ_OPTIONAL = new Set(['Detect', 'Draft', 'Auto-complete', 'Squash', 'Delete source branch', 'Bypass policy', 'Transition work items'])

// Azure CLI replaces a word that starts with `@`, or whose part after its
// first `=` does, with that file's contents before parsing it.
function azReadsFile(word: string): boolean {
  const eq = word.indexOf('=')
  return word.startsWith('@') || (eq >= 0 && word.slice(eq + 1).startsWith('@'))
}

// Control characters could move the cursor or recolor the transcript, and so
// redraw what the person reads; they are shown as escapes instead.
// Bidi overrides, zero-width, filler and tag characters reorder or hide
// text the same way.
function visible(text: string): string {
  return text.replace(
    /[\u0000-\u0008\u000b-\u001f\u007f-\u009f\u00ad\u034f\u115f\u1160\u200b-\u200f\u2028-\u202e\u2060-\u206f\u3164\ufe00-\ufe0f\ufeff\uffa0\u{e0000}-\u{e0fff}]/gu,
    c => `\\u{${(c.codePointAt(0) ?? 0).toString(16)}}`,
  )
}

function oneLine(text: string): string {
  return visible(text.replace(/\r?\n/g, ' ⏎ '))
}

// A block of posted text, every line behind a bar so nothing in it can pass
// for one of the fields around it.
export function block(title: string, text: string): string {
  const lines = text === '' ? ['(empty)'] : visible(text).split('\n')
  return [`  ${title}`, ...lines.map(l => `  │ ${l}`)].join('\n')
}

function fields(rows: readonly (readonly [string, string])[]): string[] {
  const width = Math.max(0, ...rows.map(([k]) => k.length))
  return rows.map(([k, v]) => `  ${k.padEnd(width)}  ${oneLine(v)}`)
}

function formatCli(words: readonly string[]): Shown | undefined {
  const four = words.slice(0, 4).join(' ')
  const name = SPECS[four] !== undefined ? four : words.slice(0, 3).join(' ')
  const spec = SPECS[name]
  if (spec === undefined) return undefined
  const az = name.startsWith('az ')
  if (az && words.some(azReadsFile)) return undefined
  const rows: [string, string][] = []
  const blocks: string[] = []
  const notes: string[] = []
  const bodyFiles: string[] = []
  const values: Record<string, string> = {}
  let target: string | undefined
  for (let i = name.split(' ').length; i < words.length; i++) {
    const word = words[i] ?? ''
    const eq = word.startsWith('--') ? word.indexOf('=') : -1
    const flag = eq > 0 ? word.slice(0, eq) : word
    const single = spec.values[flag]
    const many = spec.multi?.[flag]
    const field = single ?? many
    if (field !== undefined) {
      let value: string | undefined
      if (eq > 0) {
        value = word.slice(eq + 1)
      } else if (many !== undefined) {
        const parts: string[] = []
        while (i + 1 < words.length && !(words[i + 1] ?? '').startsWith('-')) parts.push(words[++i] ?? '')
        value = parts.length > 0 ? parts.join('\n') : undefined
      } else if (az && AZ_OPTIONAL.has(field) && (words[i + 1] ?? '-').startsWith('-')) {
        value = 'true'
      } else {
        value = words[++i]
      }
      // gh and az keep only the last of a repeated flag; showing both would
      // show text that never gets posted.
      if (value === undefined || values[field] !== undefined) return undefined
      // argparse reads a word starting with `-` as the next flag, not a value.
      if (az && eq < 0 && value.startsWith('-')) return undefined
      values[field] = value
      if (field === 'Body file') bodyFiles.push(value)
      if (BLOCKS.has(field)) blocks.push(block(field, value))
      else rows.push([field, value])
    } else if (spec.bools[flag] !== undefined && eq < 0) {
      notes.push(spec.bools[flag] ?? '')
    } else if (!word.startsWith('-') && spec.target !== undefined && target === undefined) {
      target = word
      values[spec.target] = word
    } else {
      // An unknown flag might take the next word as its value; rather than
      // guess and label that word wrongly, show the command as written.
      return undefined
    }
  }
  if (target !== undefined && spec.target !== undefined) rows.unshift([spec.target, target])
  if (notes.length > 0) rows.push([name === 'gh pr review' ? 'Review' : 'Also', notes.join(', ')])
  // What the call does goes in the dialog's one line too: a phone card may
  // show nothing else.
  const title = values['Title']
  const head = [name, values['PR'], values['Vote'], values['Status'], values['Method'], values['Resource'], title === undefined ? undefined : `"${oneLine(title)}"`]
    .filter(p => p !== undefined)
    .join(' ')
  return { text: [name, ...fields(rows), ...blocks].join('\n'), head: oneLine(head), bodyFiles, name, values }
}

// `zsh`: the command runs under zsh, which reads a heredoc body as written;
// anything else is read the way macOS's bash 3.2 would.
export function formatCommand(command: string, zsh = false): Shown {
  const words = shellWords(command, zsh)
  const formatted = words === undefined ? undefined : formatCli(words)
  return formatted ?? { text: command, head: oneLine(command.split('\n')[0] ?? '') }
}

const NOT_INPUT = new Set(['tool', 'tool_use_id', 'agentId', 'consent', 'requestMeta'])

// An MCP call's arguments as fields; long or multi-line text as a block.
export function formatTool(e: object & { tool: string }): Shown {
  const [, server = '', name = e.tool] = e.tool.split('__')
  const head = `${server} ${name}`
  const rows: [string, string][] = []
  const blocks: string[] = []
  for (const [key, value] of Object.entries(e)) {
    if (NOT_INPUT.has(key) || value === undefined) continue
    // A key is drawn as a label; one that isn't a plain name could pass for
    // another row, so the call is shown as JSON instead.
    if (!/^[A-Za-z0-9_]+$/.test(key)) return { text: JSON.stringify(e, null, 2), head }
    if (typeof value === 'string' && (value.includes('\n') || value.length > 80)) blocks.push(block(key, value))
    else rows.push([key, typeof value === 'string' ? value : JSON.stringify(value)])
  }
  return { text: [head, ...fields(rows), ...blocks].join('\n'), head }
}
