// Lays a gated call out for the person approving it: fields on their own
// lines and the text that gets posted as plain text, not a shell command.
// Anything this can't read exactly falls back to the command as written, so
// the layout never shows something other than what runs.

export type Shown = {
  // The whole layout, drawn in the transcript above the dialog.
  text: string
  // One line naming the call, for the dialog's question.
  head: string
}

// The body of `"$(cat <<'EOF' ... EOF)"`, how Claude passes multi-line text.
const HEREDOC_SUB = /^\$\(\s*cat\s+<<(-?)\s*(['"]?)([A-Za-z_][A-Za-z0-9_]*)\2[ \t]*\n([\s\S]*?)\n[ \t]*\3[ \t]*\n?\s*\)/

// Unquoted characters whose meaning never depends on the shell. `#` starts a
// comment only at the start of a word, which is checked apart.
const LITERAL = /[A-Za-z0-9._/@+#=:,%-]/

// The words a simple command passes, as the shell would pass them, or
// undefined when any of them depends on the shell at run time (a variable, a
// glob, a second command, a substitution other than a quoted heredoc).
export function shellWords(command: string): string[] | undefined {
  const src = command.trim()
  const words: string[] = []
  let word: string | undefined
  let i = 0
  while (i < src.length) {
    const c = src.charAt(i)
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
      if (end === -1) return undefined
      word = (word ?? '') + src.slice(i + 1, end)
      i = end + 1
    } else if (c === '"') {
      const quoted = doubleQuoted(src, i + 1)
      if (quoted === undefined) return undefined
      word = (word ?? '') + quoted.text
      i = quoted.end + 1
    } else if (LITERAL.test(c) && !(c === '#' && word === undefined)) {
      word = (word ?? '') + c
      i++
    } else {
      return undefined
    }
  }
  if (word !== undefined) words.push(word)
  return words
}

function doubleQuoted(src: string, start: number): { text: string; end: number } | undefined {
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
      const h = HEREDOC_SUB.exec(src.slice(j))
      if (!h) return undefined
      const [whole, dash = '', quote = '', , body = ''] = h
      // An unquoted delimiter expands `$x` and backticks in the body.
      if (quote === '' && /[$`\\]/.test(body)) return undefined
      text += dash === '-' ? body.replace(/^\t+/gm, '') : body
      j += whole.length
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
  // Flags without a value and what each means.
  bools: Readonly<Record<string, string>>
  // Label of the positional argument, or undefined when none is taken.
  target?: string
}

const BODY = { '--body': 'Body', '-b': 'Body', '--body-file': 'Body file', '-F': 'Body file', '--repo': 'Repo', '-R': 'Repo' }

// gh reuses short flags per command (`-a` is --assignee for an issue and
// --approve for a review), so each command has its own table.
const GH: Readonly<Record<string, Spec>> = {
  'pr comment': {
    values: BODY,
    bools: { '--edit-last': 'Edits your last comment', '--delete-last': 'Deletes your last comment', '--create-if-none': 'Creates one if none exists', '--yes': 'Skips confirmation', '--web': 'Opens the browser', '-w': 'Opens the browser', '--editor': 'Opens an editor', '-e': 'Opens an editor' },
    target: 'PR',
  },
  'pr review': {
    values: BODY,
    bools: { '--approve': 'Approve', '-a': 'Approve', '--request-changes': 'Request changes', '-r': 'Request changes', '--comment': 'Comment', '-c': 'Comment' },
    target: 'PR',
  },
  'issue create': {
    values: { ...BODY, '--title': 'Title', '-t': 'Title', '--assignee': 'Assignees', '-a': 'Assignees', '--label': 'Labels', '-l': 'Labels', '--milestone': 'Milestone', '-m': 'Milestone', '--project': 'Project', '-p': 'Project', '--template': 'Template', '-T': 'Template' },
    bools: { '--web': 'Opens the browser', '-w': 'Opens the browser', '--editor': 'Opens an editor', '-e': 'Opens an editor' },
  },
}

// Control characters could move the cursor or recolor the transcript, and so
// redraw what the person reads; they are shown as escapes instead.
function visible(text: string): string {
  return text.replace(/[\u0000-\u0008\u000b-\u001f\u007f-\u009f]/g, c => `\\x${c.charCodeAt(0).toString(16).padStart(2, '0')}`)
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

function formatGh(words: readonly string[]): Shown | undefined {
  const name = `${words[1] ?? ''} ${words[2] ?? ''}`
  const spec = GH[name]
  if (words[0] !== 'gh' || spec === undefined) return undefined
  const rows: [string, string][] = []
  const blocks: string[] = []
  const notes: string[] = []
  let target: string | undefined
  let title: string | undefined
  for (let i = 3; i < words.length; i++) {
    const word = words[i] ?? ''
    const eq = word.startsWith('--') ? word.indexOf('=') : -1
    const flag = eq > 0 ? word.slice(0, eq) : word
    const field = spec.values[flag]
    if (field !== undefined) {
      const value = eq > 0 ? word.slice(eq + 1) : words[++i]
      if (value === undefined) return undefined
      if (field === 'Body') blocks.push(block('Body', value))
      else rows.push([field, value])
      if (field === 'Title') title = value
    } else if (spec.bools[flag] !== undefined && eq < 0) {
      notes.push(spec.bools[flag] ?? '')
    } else if (!word.startsWith('-') && spec.target !== undefined && target === undefined) {
      target = word
    } else {
      // An unknown flag might take the next word as its value; rather than
      // guess and label that word wrongly, show the command as written.
      return undefined
    }
  }
  const head = [`gh ${name}`, target, title === undefined ? undefined : `"${oneLine(title)}"`].filter(p => p !== undefined).join(' ')
  if (target !== undefined && spec.target !== undefined) rows.unshift([spec.target, target])
  if (notes.length > 0) rows.push([spec === GH['pr review'] ? 'Review' : 'Also', notes.join(', ')])
  return { text: [`gh ${name}`, ...fields(rows), ...blocks].join('\n'), head: oneLine(head) }
}

export function formatCommand(command: string): Shown {
  const words = shellWords(command)
  const formatted = words === undefined ? undefined : formatGh(words)
  return formatted ?? { text: command, head: oneLine(command.split('\n')[0] ?? '') }
}

const NOT_INPUT = new Set(['tool', 'tool_use_id', 'agentId', 'consent', 'requestMeta'])

// An MCP call's arguments as fields; long or multi-line text as a block.
export function formatTool(e: object & { tool: string }): Shown {
  const [, server = '', name = e.tool] = e.tool.split('__')
  const rows: [string, string][] = []
  const blocks: string[] = []
  for (const [key, value] of Object.entries(e)) {
    if (NOT_INPUT.has(key) || value === undefined) continue
    if (typeof value === 'string' && (value.includes('\n') || value.length > 80)) blocks.push(block(key, value))
    else rows.push([key, typeof value === 'string' ? value : JSON.stringify(value)])
  }
  const head = `${server} ${name}`
  return { text: [head, ...fields(rows), ...blocks].join('\n'), head }
}
