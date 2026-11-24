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

export const register: Register = on => {
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
        </Box>
      </Box>
    )
  })
}
