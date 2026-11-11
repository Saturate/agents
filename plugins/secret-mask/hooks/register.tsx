import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Secret } from '../types'
import { GUIDE } from './guide'
import { Vault, isEnvFilePath, mentionsEnvFile, placeholderFor, rewriteStrings, visitStrings } from './vault'

// Bump the tag when Secret's fields change: a stored list from an older shape
// is then read as empty instead of half-parsed.
const secretsAtom = atom({ plugin: 'secret-mask', key: 'secrets' } as const, [], { shape: 'secrets-1' })
const MASK_PANE = 'secret-mask'

const ALLOW_ONCE = 'Allow once'
const ALLOW_SESSION = 'Allow for this session'
const DENY = 'Deny'

// Only the fields a tool acts on get the real value. Agent, SendMessage,
// Skill and WebFetch's `prompt` hand their text to a model, which is exactly
// where it must not go, so they are left out.
const EXECUTING_FIELDS: ReadonlyMap<string, readonly string[]> = new Map([
  ['Bash', ['command']],
  ['Edit', ['file_path', 'old_string', 'new_string']],
  ['Write', ['file_path', 'content']],
  ['NotebookEdit', ['notebook_path', 'new_source']],
  ['WebFetch', ['url']],
])

// Some MCP servers are model-backed, so an MCP tool always asks, even for a
// secret the user handed over.
function isMcp(tool: string): boolean {
  return tool.startsWith('mcp__')
}

function fieldsOf(e: object): Array<[string, string]> {
  return Object.entries(e).flatMap(([key, value]): Array<[string, string]> =>
    typeof value === 'string' ? [[key, value]] : [],
  )
}

// The string fields of a call that may be unmasked; for an MCP tool every
// argument, since its schema is the server's own.
function unmaskableText(e: { tool: string }): string {
  const fields = EXECUTING_FIELDS.get(e.tool)
  if (fields) return fieldsOf(e).filter(([key]) => fields.includes(key)).map(([, v]) => v).join('\n')
  if (isMcp(e.tool)) return JSON.stringify(e)
  return ''
}

const ENV_SCAN_DEPTH = 3
const ENV_SCAN_MAX_DIRS = 200
const ENV_SCAN_SKIP = new Set(['node_modules', '.git', 'dist', 'build', '.next', 'out', 'vendor', 'target', 'bin', 'obj'])

const vault = new Vault()
let loading: Promise<void> | undefined

// $.state survives a hot reload where module variables don't, so the vault is
// reloaded from there and placeholders already in the history keep working.
// One shared promise, so two hooks racing after a reload can't load twice and
// drop what the first one added in between.
function ensureLoaded($: EngineInterface): Promise<void> {
  loading ??= read($, secretsAtom).then(
    list => vault.load(list),
    (error: unknown) => {
      // A transient failure must not stick for the module's whole life.
      loading = undefined
      throw error
    },
  )
  return loading
}

async function persist($: EngineInterface): Promise<void> {
  if (!vault.takeDirty()) return
  const list = vault.list().map(s => ({ ...s }))
  await update($, secretsAtom, () => list)
}

// Pre-registers the values in the project's .env files, so they are masked
// wherever they show up later (logs, error output, a grep), not only when
// Claude opens the file itself.
async function scanEnvFiles($: EngineInterface): Promise<void> {
  const queue: Array<{ dir: string; depth: number }> = [{ dir: await $.session.cwd(), depth: 0 }]
  let visited = 0
  while (queue.length > 0 && visited < ENV_SCAN_MAX_DIRS) {
    const next = queue.shift()
    if (!next) break
    visited += 1
    let entries: Awaited<ReturnType<typeof $.fs.list>>
    try {
      entries = await $.fs.list(next.dir)
    } catch {
      continue
    }
    for (const entry of entries) {
      const path = `${next.dir}/${entry.name}`
      if (entry.kind === 'dir' && next.depth < ENV_SCAN_DEPTH && !ENV_SCAN_SKIP.has(entry.name)) {
        queue.push({ dir: path, depth: next.depth + 1 })
      } else if (entry.kind === 'file' && isEnvFilePath(`/${entry.name}`)) {
        try {
          const text = await $.fs.read(path)
          if (typeof text === 'string') vault.detectEnvFile(text)
        } catch {
          // Unreadable or over the 4 MiB read limit: Read output still gets masked.
        }
      }
    }
  }
}

const PREVIEW_LIMIT = 1500
const PREVIEW_WINDOW = 120

// The person approves where the value goes, so a long command must not be
// cut before that part: past the limit, show the start, the text around
// every placeholder, and the end.
function preview(input: unknown): string {
  const text = typeof input === 'object' && input !== null && 'command' in input && typeof input.command === 'string'
    ? input.command
    : JSON.stringify(input)
  if (text.length <= PREVIEW_LIMIT) return text
  const spans: Array<[number, number]> = [[0, PREVIEW_WINDOW], [text.length - PREVIEW_WINDOW * 2, text.length]]
  for (const m of text.matchAll(/\{\{SECRET_\d+[^}]*\}\}/g)) {
    const at = m.index ?? 0
    spans.push([Math.max(0, at - PREVIEW_WINDOW), Math.min(text.length, at + m[0].length + PREVIEW_WINDOW)])
  }
  spans.sort((a, b) => a[0] - b[0])
  const merged: Array<[number, number]> = []
  for (const span of spans) {
    const last = merged[merged.length - 1]
    if (last && span[0] <= last[1]) last[1] = Math.max(last[1], span[1])
    else merged.push([span[0], span[1]])
  }
  return merged.map(([from, to]) => text.slice(from, to)).join(' … ')
}

function linesWith(text: string, n: number): Set<string> {
  return new Set(text.split('\n').filter(line => vault.placeholdersIn(line).includes(n)))
}

async function addUserSecret($: EngineInterface, value: string): Promise<void> {
  await ensureLoaded($)
  const secret = vault.addUser(value)
  await persist($)
  await $.prompt.fill({ text: placeholderFor(secret), mode: 'insert' })
}


export const register: Register = on => {
  // prompt.compose would be the natural place, but the built-in sec-default
  // guard keeps user-installed mods off it, so the guide rides on Bash's
  // description. It must stay identical for the whole session: a changed tool
  // description discards the prompt cache.
  on('tool.describe', { tool: 'Bash' }, async ($, e, next) => {
    const described = await next(e)
    return { ...described, description: `${described.description}\n\n${GUIDE}` }
  })

  on('session.start', async ($, e, next) => {
    // Commands first, so a failing env scan can't leave the session without them.
    await $.command.register({ name: 'secrets', description: 'List the secrets secret-mask is hiding from Claude' })
    await $.command.register({ name: 'mask', description: 'Mask a secret: /mask <value>, or /mask alone for a field', argumentHint: '<value>' })
    await ensureLoaded($)
    await scanEnvFiles($)
    await persist($)
    return next(e)
  }).catch(($, e, next) => next(e))

  on('command.run', async ($, e, next) => {
    if (e.command === 'secrets') {
      await ensureLoaded($)
      const list = vault.list()
      if (list.length === 0) return { text: 'secret-mask: nothing masked yet.' }
      // Labels and numbers only: a command's reply can reach the model.
      const lines = list.map(s => `${placeholderFor(s)}  ${s.isAllowed ? 'allowed' : 'asks before use'}`)
      return { text: ['secret-mask is hiding:', ...lines].join('\n') }
    }

    if (e.command === 'mask') {
      const value = e.args.trim()
      // A pane opened with focus takes the keyboard at once; the band above
      // the prompt does not, so typing there lands in the prompt.
      if (value.length === 0) {
        await $.ui.open({ id: MASK_PANE, title: 'Mask a secret', focus: true, closeOnEscape: true, rows: 4 })
        return {}
      }
      await addUserSecret($, value)
      // No reply text: a command's reply can reach the model, and the
      // placeholder in the prompt box is confirmation enough.
      return {}
    }

    // Skill and prompt commands send their arguments to the model, and
    // prompt.submit does not apply a rewrite to a command's line.
    await ensureLoaded($)
    const args = vault.maskPrompt(e.args)
    await persist($)
    return args === e.args ? next(e) : next({ ...e, args })
  }).catch(($, e, next) =>
    next.called ? next(e) : { text: 'secret-mask failed, so this command was not run, to keep its arguments from Claude.' },
  )

  // The value goes from this field straight into the vault, so it never
  // passes through the prompt at all.
  on('ui.render', { component: 'Pane', requestId: MASK_PANE }, async ($, e) => {
    const { Box, Input, Text } = $.ui.resolve(e)
    return (
      <Box flexDirection="column">
        <Text dimColor>Stays on this machine. Shown while you type. Esc cancels.</Text>
        <Input
          key="secret"
          label="Secret"
          placeholder="paste the value, then Enter"
          submitLabel="Mask"
          autoFocus
          onSubmit={async value => {
            await $.ui.close({ id: MASK_PANE })
            if (value.length > 0) await addUserSecret($, value)
          }}
        />
      </Box>
    )
  })

  on('prompt.submit', async ($, e, next) => {
    if (e.command) return next(e)
    await ensureLoaded($)
    const text = vault.maskPrompt(e.text)
    await persist($)
    if (text === e.text) return next(e)
    // A hidden prompt that starts a turn (a peer's message, a channel post)
    // takes no rewrite of its text. Resubmitting it masked isn't possible:
    // the engine refuses $.prompt.submit from inside this hook, and a
    // resubmit would carry this plugin's origin instead of the sender's.
    if (e.isMeta === true && e.turnId === undefined) {
      $.ui.toast('secret-mask dropped an incoming message because it held a secret.')
      return { drop: 'secret-mask dropped this message because it held a secret, and hidden messages that start a turn cannot be rewritten.' }
    }
    return next({ ...e, text })
  }).catch(($, e, next) =>
    next.called ? next(e) : { drop: 'secret-mask failed, so this prompt was not sent, to keep any secret in it from Claude.' },
  )

  // session.append would cover every row, but the built-in sec-default guard
  // keeps user-installed mods off it. @-mentions skip tool.call, so a file
  // holding secrets is kept out and Claude is pointed at Read, which masks.
  on('prompt.mention', async ($, e, next) => {
    await ensureLoaded($)
    let text: string
    try {
      const read = await $.fs.read(e.path)
      if (typeof read !== 'string') return next(e)
      text = read
    } catch {
      return next(e)
    }
    if (!vault.containsSecret(text, { isEnvFile: isEnvFilePath(e.path) })) return next(e)
    return { deny: `secret-mask: ${e.mention} holds secrets. Ask Claude to open it with the Read tool instead, which masks them.` }
  }).catch(($, e, next) => (next.called ? next(e) : { deny: 'secret-mask could not check this file, so it was not attached.' }))

  on('tool.call', async ($, e, next) => {
    await ensureLoaded($)
    let input = e
    const used = vault.placeholdersIn(unmaskableText(e))

    if (used.length > 0) {
      const pending = used.flatMap((n): Secret[] => {
        const s = vault.byNumber(n)
        return s && (!s.isAllowed || isMcp(e.tool)) ? [s] : []
      })
      // An edit whose every placeholder is already in the text it replaces
      // keeps the secret where it was. Asking there would only add friction.
      // Line by line, so an edit can't carry the value into a new command
      // in the same hunk.
      const isInPlaceEdit =
        e.tool === 'Edit' &&
        vault.placeholdersIn(e.file_path).length === 0 &&
        vault.placeholdersIn(e.new_string).every(n => {
          const before = linesWith(e.old_string, n)
          return [...linesWith(e.new_string, n)].every(line => before.has(line))
        })

      if (pending.length > 0 && !isInPlaceEdit) {
        const names = pending.map(placeholderFor).join(', ')
        let answer: string
        try {
          answer = await $.ui.ask(`${e.tool} wants to use ${names}: ${preview(e)}. Put the real value in?`, {
            header: 'Secret',
            options: [ALLOW_ONCE, ALLOW_SESSION, DENY],
          })
        } catch {
          // Dismissed, or a -p run where nobody can answer.
          answer = DENY
        }
        if (answer !== ALLOW_ONCE && answer !== ALLOW_SESSION) {
          return { deny: `secret-mask: the user did not allow ${names} in this call. Do not try to work around the mask.` }
        }
        if (answer === ALLOW_SESSION) {
          for (const s of pending) vault.allow(s.n)
          await persist($)
        }
      }

      const copy = structuredClone(e)
      const fields = EXECUTING_FIELDS.get(e.tool)
      if (fields) {
        for (const [key, value] of fieldsOf(copy)) {
          if (fields.includes(key)) Reflect.set(copy, key, vault.unmask(value))
        }
      } else {
        rewriteStrings(copy, s => vault.unmask(s))
      }
      input = copy
    }

    const isEnvRead =
      (e.tool === 'Read' && isEnvFilePath(e.file_path)) || (e.tool === 'Bash' && mentionsEnvFile(e.command))
    const ran = await next(input)

    // A permission layer or hook below can echo the unmasked input back.
    if (ran.deny !== undefined) {
      vault.detect(ran.deny)
      await persist($)
      const deny = vault.maskKnown(ran.deny)
      return deny === ran.deny ? ran : { deny }
    }

    // Detect across every field before masking any, so a secret first seen
    // in stderr is also masked in stdout.
    visitStrings(ran.result, s => {
      vault.detect(s)
      if (isEnvRead) vault.detectEnvFile(s)
    })
    if (typeof ran.text === 'string') vault.detect(ran.text)
    for (const c of ran.context ?? []) vault.detect(c)
    await persist($)

    const holder = { result: structuredClone(ran.result) }
    let isResultChanged = false
    rewriteStrings(holder, s => {
      const out = vault.maskKnown(s)
      if (out !== s) isResultChanged = true
      return out
    })
    const text = typeof ran.text === 'string' ? vault.maskKnown(ran.text) : undefined
    const isTextChanged = text !== ran.text

    const context = ran.context?.map(c => vault.maskKnown(c))
    const isContextChanged = context?.some((c, i) => c !== ran.context?.[i]) ?? false
    if (!isResultChanged && !isTextChanged && !isContextChanged) return ran
    // A hook may add context entries but not change one, and an errored call
    // can carry its error only in `text`, which a hook can't set. In those
    // cases withholding the result, with the masked text as the reason, is
    // the one way the model still reads the output without the value.
    if (isContextChanged || ran.isError === true || (isTextChanged && !isResultChanged)) {
      const body = text ?? JSON.stringify(holder.result)
      return { deny: [body, ...(isContextChanged && context ? context : [])].join('\n\n') }
    }
    return { result: holder.result, context: ran.context, isError: ran.isError }
  }).catch(($, e, next) =>
    // Before next: nothing was unmasked, so running with the placeholders as
    // literal text is safe, and failing closed would brick every tool call.
    // After next: the settled result is raw, so it must not be replayed.
    next.called ? { deny: 'secret-mask could not mask this result, so it was withheld.' } : next(e),
  )
}
