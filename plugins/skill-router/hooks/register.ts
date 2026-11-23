import type { EngineInterface, Register } from 'claude-code'

import { block, formatCommand, formatTool } from './format'
import type { Shown } from './format'
import { commandSegments, judge, outerParts, outerSegments, parseRules, ruleId, skillName } from './rules'
import type { Rule } from './rules'

const MAIN = 'main'
const PREVIEW_LIMIT = 1500
const RUN = 'Run it'
const SESSION = 'Allow for this session'
const ALWAYS = 'Always allow in this project'
const DONT_RUN = "Don't run"

// Skills whose text is in each conversation's context, keyed by subagent: a
// subagent didn't read the skills its parent loaded.
const loaded = new Map<string, Set<string>>()
let rules: Promise<Rule[]> | undefined

function loadedFor(agentId: string | undefined): Set<string> {
  const key = agentId ?? MAIN
  let set = loaded.get(key)
  if (!set) {
    set = new Set()
    loaded.set(key, set)
  }
  return set
}

function loadRules($: EngineInterface): Promise<Rule[]> {
  rules ??= $.fs.read(`${$.plugin.root}/scripts/advisor-rules.conf`).then(
    text => (typeof text === 'string' ? parseRules(text) : []),
    (error: unknown) => {
      rules = undefined
      throw error
    },
  )
  return rules
}

// The plugin that ships this repo's skills; installed that way they are
// named `agents:commit`.
const SKILLS_PLUGIN = 'agents'

// The rule name a loaded skill satisfies, or undefined. An unknown name loads
// nothing, and another plugin's skill that happens to be called `commit` is
// not this repo's commit skill.
async function ruleSkill($: EngineInterface, name: string): Promise<string | undefined> {
  const wanted = name.replace(/^\//, '')
  const commands = await $.command.list()
  const entry = commands.find(c => c.name === wanted) ?? commands.find(c => c.name === `${SKILLS_PLUGIN}:${wanted}`)
  if (!entry || (entry.plugin !== undefined && entry.plugin !== SKILLS_PLUGIN)) return undefined
  return skillName(entry.name)
}

function preview(text: string): string {
  if (text.length <= PREVIEW_LIMIT) return text
  return `${text.slice(0, PREVIEW_LIMIT)}…\n(${text.length - PREVIEW_LIMIT} more characters not shown; ask Claude for the full text before approving)`
}

function listSkills(skills: readonly string[]): string {
  return skills.map(s => `\`/${s}\``).join(' and ')
}

const STORE_KEY = 'allowed-gates'

// Allows that last until the session ends, never written down. Keyed by
// sessionKey: one hooks module can serve several sessions (teammates).
const sessionAllowed = new Map<string, Set<string>>()

async function sessionKey($: EngineInterface, scope: string | undefined): Promise<string | undefined> {
  if (scope === undefined) return undefined
  return $.session.id().then(id => `${id}\n${scope}`, () => undefined)
}

// Force pushes and hard resets are judged per command, never per project,
// and so is anything a rule marks confirm-each (a fork names its target as a
// plain argument anywhere among its flags, and happens once anyway).
function neverAlways(gate: Rule): boolean {
  return gate.skills.includes('confirm-destructive') || gate.skills.includes('confirm-each')
}

// "Always" covers only calls whose every word is known not to pick another
// repo: shell quoting, escapes, expansions, env prefixes and unknown flags
// can all point gh elsewhere, so an allowlist, not a list of bad spellings.
const VALUE_FLAGS = new Set(['--body', '-b', '--body-file', '-F', '--title', '-t', '--label', '-l', '--assignee', '-a', '--reviewer', '--milestone', '-m'])
const BOOL_FLAGS = new Set(['--approve', '--comment', '-c', '--request-changes', '--edit-last', '--delete-last', '--yes', '--draft', '-d'])
// Quoted text arrives blanked to `""` or `''`; it is only safe as a flag's value.
const BLANKED = /^(?:""|'')$/
const PLAIN = /^[A-Za-z0-9._/@+#][A-Za-z0-9._/@+#-]*$/

function plainValue(value: string | undefined): boolean {
  return value !== undefined && (PLAIN.test(value) || BLANKED.test(value))
}

function plainArgs(rest: string): boolean {
  const words = rest.trim().split(/\s+/).filter(w => w.length > 0)
  for (let i = 0; i < words.length; i++) {
    const word = words[i] ?? ''
    const eq = word.indexOf('=')
    if (word.startsWith('-') && eq > 0) {
      if (!VALUE_FLAGS.has(word.slice(0, eq)) || !plainValue(word.slice(eq + 1))) return false
    } else if (VALUE_FLAGS.has(word)) {
      i++
      if (!plainValue(words[i])) return false
    } else if (!BOOL_FLAGS.has(word) && !PLAIN.test(word)) {
      return false
    }
  }
  return true
}

function isGated(gates: readonly Rule[], segment: string): boolean {
  return gates.some(g => g.target === 'command' && g.pattern.test(segment))
}

// Every command in the call is a gated one with plain arguments, and none
// hides inside a `$(...)` where a `cd` beside it would move it. Anything else
// (a `cd` however it is spelled, a prefix, an odd flag) means the dialog asks.
function plainCall(command: string, gates: readonly Rule[]): boolean {
  const outer = outerSegments(command)
  // The rules read a no-break space or a vertical tab as a word break; the
  // shell doesn't, so `origin<NBSP>-q` would be one word to git and two here.
  if (outer.some(segment => /[^\x20-\x7e\t]/.test(segment))) return false
  const gatedEverywhere = commandSegments(command).filter(s => isGated(gates, s)).length
  if (outer.filter(s => isGated(gates, s)).length !== gatedEverywhere) return false
  return outer.every(segment => {
    // Azure CLI reads `@file` words as more arguments, so az is scoped only
    // through azScope.
    if (/^\s*az\s/.test(segment)) return false
    const gate = gates.find(g => g.target === 'command' && g.pattern.test(segment))
    const match = gate?.pattern.exec(segment)
    return match !== undefined && match !== null && plainArgs(segment.slice(match.index + match[0].length))
  })
}

// Whether the Bash tool runs zsh, worked out as Claude Code picks its shell:
// the first of CLAUDE_CODE_SHELL and SHELL that names bash or zsh and is
// executable. Anything unsure means bash, whose rules are the stricter ones.
async function detectZsh($: EngineInterface): Promise<boolean> {
  const env = await $.process.run(['env', '-0'])
  if (env.exitCode !== 0) return false
  const vars = new Map(env.stdout.split('\0').map(entry => [entry.slice(0, entry.indexOf('=')), entry.slice(entry.indexOf('=') + 1)]))
  for (const name of ['CLAUDE_CODE_SHELL', 'SHELL']) {
    const path = vars.get(name)
    if (path === undefined || !/bash|zsh/.test(path)) continue
    // Claude Code finds a bare name on its own PATH, which may not be this
    // process's; not knowing which shell that is means bash rules.
    if (!path.startsWith('/')) return false
    const test = await $.process.run(['test', '-x', path])
    if (test.exitCode === 0) return path.split('/').pop() === 'zsh'
  }
  return false
}

function runsUnderZsh($: EngineInterface): Promise<boolean> {
  return detectZsh($).catch(() => false)
}

// Variables in Claude Code's own environment that steer gh or git elsewhere.
const STEERING_ENV = /^(?:GH_REPO|GH_HOST|GIT_DIR|GIT_WORK_TREE|GIT_CONFIG\w*)=/m

// gh posts to its default repo, which with several remotes or a
// `gh repo set-default` need not be origin. Only a repo with exactly one
// remote and no gh override can be named by that remote. Run in the
// session's directory, which is where the Bash command runs.
async function soleRemote($: EngineInterface): Promise<string | undefined> {
  const env = await $.process.run(['env'])
  if (env.exitCode !== 0 || STEERING_ENV.test(env.stdout)) return undefined
  const { exitCode, stdout } = await $.process.run(['git', 'config', '--get-regexp', '^remote\\.'], { cwd: await $.session.cwd() })
  if (exitCode !== 0) return undefined
  const lines = stdout.split('\n').filter(l => l.length > 0)
  if (lines.some(l => /^remote\.[^ ]*\.gh-resolved /.test(l))) return undefined
  const urls = lines.flatMap(l => /^remote\.[^ ]*\.url (.+)$/.exec(l)?.[1] ?? [])
  return urls.length === 1 && urls[0] !== undefined ? normalizeRemote(urls[0]) : undefined
}

// ssh and https clones of one repo share their allows, and credentials in an
// https remote never reach the store.
export function normalizeRemote(remote: string): string {
  const trimmed = remote.trim()
  // Only a URL with a scheme has a port after the host; in scp form
  // (`git@host:1234/repo`) the part after the colon is the owner.
  const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
  const bare = trimmed.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '').replace(/^[^@/]+@/, '')
  return (hasScheme ? bare.replace(/^([^/:]+):\d+\//, '$1/') : bare.replace(/^([^/:]+):/, '$1/'))
    .replace(/\.git$/, '')
    .replace(/\/+$/, '')
    // Azure DevOps ssh and https remotes spell the same repo differently.
    .replace(/^ssh\.dev\.azure\.com\/v3\//i, 'dev.azure.com/')
    .replace(/\/_git\//, '/')
    .toLowerCase()
}

function stringArg(e: object, name: string): string | undefined {
  const value: unknown = Reflect.get(e, name)
  return typeof value === 'string' ? value : undefined
}

// Remote keys that don't change where a push goes or what ls-remote reads.
// pushurl, push, receivepack, uploadpack, vcs and anything new mean asking.
const HARMLESS_REMOTE_KEYS = new Set(['url', 'fetch', 'tagopt', 'prune', 'prunetags', 'skipfetchall', 'skipdefaultupdate', 'promisor', 'partialclonefilter'])

// push.* keys that don't widen what an explicit `git push <remote> <branch>`
// sends: followTags pushes tags, recurseSubmodules pushes other repos,
// pushOption talks to the server. push.default is judged on its value.
const HARMLESS_PUSH_KEYS = new Set(['default', 'autosetupremote', 'useforceifincludes', 'negotiate', 'usebitmaps', 'gpgsign'])

type ConfigEntry = { key: string; value: string }

// `git config -z` ends each entry with NUL and puts a newline between key and
// value, so a value can't pass for a key the way it can in the plain output.
function configEntries(stdout: string): ConfigEntry[] {
  return stdout
    .split('\0')
    .filter(record => record.length > 0)
    .map(record => {
      const nl = record.indexOf('\n')
      return nl === -1 ? { key: record, value: '' } : { key: record.slice(0, nl), value: record.slice(nl + 1) }
    })
}

function configHarmless({ key, value }: ConfigEntry): boolean {
  const lower = key.toLowerCase()
  // `remote.pushDefault` has no remote name, and an explicit remote wins over it.
  if (lower === 'remote.pushdefault') return true
  const remote = /^remote\..+\.([^.]+)$/.exec(lower)
  if (remote?.[1] !== undefined) return HARMLESS_REMOTE_KEYS.has(remote[1])
  const push = /^push\.([^.]+)$/.exec(lower)
  if (push?.[1] !== undefined) return HARMLESS_PUSH_KEYS.has(push[1]) && !(push[1] === 'default' && /^(?:upstream|tracking)$/i.test(value))
  return lower.startsWith('url.')
}

function isLease(gate: Rule): boolean {
  return gate.skills.includes('confirm-lease')
}

// A lease push may be allowed only where it lands on a branch other than the
// remote's default, on the repo the scope names.
// - A push URL, push refspecs or a url.*.insteadOf rewrite of this remote
//   would send it somewhere else.
// - With push.default upstream (or tracking), `git push origin feat` goes to
//   feat's upstream, which is main for a branch made from origin/main.
// - The word must name a local branch by its own name: `refs/heads/main`,
//   `heads/main`, a tag, or `head` (HEAD on a case-insensitive filesystem)
//   would push something else.
// - The default is asked of the remote, not read from origin/HEAD: that is
//   local state an earlier command could have moved, and goes stale when the
//   default changes on the server. No answer means asking.
async function leaseOffDefault($: EngineInterface, command: string, gates: readonly Rule[]): Promise<boolean> {
  const lease = gates.filter(isLease)
  const cwd = await $.session.cwd()
  const config = await $.process.run(['git', 'config', '-z', '--get-regexp', '^(remote|url|push)\\.'], { cwd })
  // Exit 1 means no key matched, which can't be: a lease push needs a remote.
  if (config.exitCode !== 0) return false
  const entries = configEntries(config.stdout)
  if (!entries.every(configHarmless)) return false
  const remotes = entries.flatMap(({ key, value }) => {
    const name = /^remote\.(.+)\.url$/i.exec(key)?.[1]
    return name === undefined ? [] : [{ name, url: value }]
  })
  const only = remotes.length === 1 ? remotes[0] : undefined
  if (only === undefined) return false
  const rewrites = entries.flatMap(({ key, value }) => (/^url\..*\.(?:insteadof|pushinsteadof)$/i.test(key) ? [value] : []))
  if (rewrites.some(prefix => only.url.startsWith(prefix))) return false
  for (const segment of outerSegments(command)) {
    if (!lease.some(g => g.pattern.test(segment))) continue
    const [remote, branch] = segment.trim().split(/\s+/).slice(2).filter(w => !w.startsWith('-'))
    if (remote === undefined || branch === undefined || only.name !== remote || branch.toLowerCase() === 'head') return false
    const ref = await $.process.run(['git', 'rev-parse', '--symbolic-full-name', branch], { cwd })
    if (ref.exitCode !== 0 || ref.stdout.trim() !== `refs/heads/${branch}`) return false
    // No one answers a credential prompt here; failing means asking. The
    // user's own ssh setup is kept, so a passphrase prompt runs to the timeout.
    const head = await $.process.run(['env', 'GIT_TERMINAL_PROMPT=0', 'GCM_INTERACTIVE=never', 'git', 'ls-remote', '--symref', remote, 'HEAD'], { cwd, timeoutMs: 10000 })
    const target = /^ref: (refs\/heads\/\S+)\tHEAD$/m.exec(head.stdout)?.[1]
    // Case is folded because a case-insensitive filesystem resolves `Main` to
    // the local main branch.
    if (head.exitCode !== 0 || target === undefined || target.toLowerCase() === `refs/heads/${branch}`.toLowerCase()) return false
  }
  return true
}

// Fields that point az at another organization or let a PR skip policy.
const AZ_ELSEWHERE = ['Org', 'Detect', 'Subscription', 'Bypass policy', 'Bypass reason']

// An az PR command names its PR by an id that is unique across the whole
// organization, not by repo. It is scoped to this repo only when az, asked
// the way the command will ask it (same directory, same detection), says
// that PR lives in the repo this directory's one remote points at.
async function azScope($: EngineInterface, shown: Shown): Promise<string | undefined> {
  if (shown.name !== 'az repos pr set-vote' && shown.name !== 'az repos pr update') return undefined
  const values = shown.values ?? {}
  const id = values['PR']
  if (id === undefined || !/^\d+$/.test(id) || AZ_ELSEWHERE.some(k => values[k] !== undefined)) return undefined
  const remote = await soleRemote($)
  if (remote === undefined) return undefined
  // A PR that already carries a policy bypass sends it again on completion.
  const { exitCode, stdout } = await $.process.run(
    ['az', 'repos', 'pr', 'show', '--id', id, '--query', '[repository.webUrl, completionOptions.bypassPolicy]', '-o', 'json'],
    { cwd: await $.session.cwd(), timeoutMs: 15000 },
  )
  if (exitCode !== 0) return undefined
  const parsed: unknown = JSON.parse(stdout)
  if (!Array.isArray(parsed)) return undefined
  const [url, bypass]: unknown[] = parsed
  return typeof url === 'string' && bypass !== true && normalizeRemote(url) === remote ? remote : undefined
}

// The scope an "always allow" covers, or undefined when the call can't be
// tied to one. A Bash command is scoped to the repo it runs in; an MCP call
// names its own Azure DevOps project and repo, which may not be this one.
async function scopeOf($: EngineInterface, e: object & { tool: string }, command: string | undefined, shown: Shown, gates: readonly Rule[]): Promise<string | undefined> {
  if (command !== undefined) {
    if (!plainCall(command, gates)) return azScope($, shown)
    if (gates.some(isLease) && !(await leaseOffDefault($, command, gates))) return undefined
    return soleRemote($)
  }
  // Bypassing branch policy is a decision about that one PR.
  if (Reflect.get(e, 'bypassPolicy') === true) return undefined
  const project = stringArg(e, 'project')
  const repository = stringArg(e, 'repositoryId')
  if (project === undefined && repository === undefined) return undefined
  const server = e.tool.split('__')[1] ?? ''
  return `mcp:${server}:${project ?? ''}/${repository ?? ''}`.toLowerCase()
}

async function readAllowed($: EngineInterface): Promise<Map<string, Set<string>>> {
  const value = await $.store.get(STORE_KEY)
  const out = new Map<string, Set<string>>()
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return out
  for (const [scope, ids] of Object.entries(value)) {
    if (Array.isArray(ids)) out.set(scope, new Set(ids.filter((v): v is string => typeof v === 'string')))
  }
  return out
}

// A failed lookup means "nothing allowed": the gates ask, instead of the
// whole hook failing open and every rule going quiet.
async function allowedIn($: EngineInterface, scope: string | undefined, session: string | undefined): Promise<Set<string>> {
  if (scope === undefined) return new Set()
  const forSession = (session === undefined ? undefined : sessionAllowed.get(session)) ?? new Set()
  try {
    return new Set([...forSession, ...((await readAllowed($)).get(scope) ?? [])])
  } catch {
    return forSession
  }
}

function allowForSession(session: string, gates: readonly Rule[]): void {
  const ids = sessionAllowed.get(session) ?? new Set()
  for (const gate of gates) ids.add(ruleId(gate))
  sessionAllowed.set(session, ids)
}

async function allowGates($: EngineInterface, scope: string, gates: readonly Rule[]): Promise<void> {
  const all = await readAllowed($)
  const ids = all.get(scope) ?? new Set()
  for (const gate of gates) ids.add(ruleId(gate))
  all.set(scope, ids)
  await $.store.set(STORE_KEY, Object.fromEntries([...all].map(([s, set]) => [s, [...set]])))
}

const BODY_FILE = /(?:^|\s)(?:--body-file|-F)(?:=|\s+)?(?:"([^"]+)"|'([^']+)'|([^\s;&|]+))/g

// `gh issue create --body-file notes.md` shows nothing of what gets posted,
// so the file's text is added to the preview. Where the command's words were
// read exactly, those are the paths; otherwise they are guessed from the
// text, and a path that depends on an earlier `cd` or a shell expansion is
// named but not read, since guessing it could show a different file.
async function bodyFiles($: EngineInterface, command: string, shown: Shown, gates: readonly Rule[]): Promise<string> {
  const exact = shown.bodyFiles !== undefined
  const moved = !exact && outerSegments(command).some(s => !isGated(gates, s))
  const paths = shown.bodyFiles ?? [...command.matchAll(BODY_FILE)].map(m => m[1] ?? m[2] ?? m[3] ?? '')
  const parts: string[] = []
  for (const path of paths) {
    if (path === '' || path === '-') continue
    // A device such as /dev/stdin could block the read.
    if (path.startsWith('/dev/')) {
      parts.push(`  Body file ${path} (not read)`)
      continue
    }
    if ((!exact && /^[~$]/.test(path)) || (moved && !path.startsWith('/'))) {
      parts.push(`  Body file ${path} (not read: its location depends on the shell)`)
      continue
    }
    try {
      const full = path.startsWith('/') ? path : `${await $.session.cwd()}/${path}`
      const text = await $.fs.read(full)
      parts.push(typeof text === 'string' ? block(`Body file ${path}`, text) : `  Body file ${path} (could not be read)`)
    } catch {
      parts.push(`  Body file ${path} (could not be read)`)
    }
  }
  return parts.join('\n')
}

// A command the layout couldn't read is named in the question by the command
// that tripped the gate, not by its first line: in `python3 - <<'PY' ... &&
// git push --force-with-lease` the push is what is being asked about. It is
// quoted as written, `-C dir` and `GIT_DIR=` included, since those say where
// it runs; one inside a `$(...)` has only its matched form, quotes blanked.
function gatedHead(shown: Shown, command: string, all: readonly Rule[], gates: readonly Rule[], zsh: boolean): Shown {
  if (shown.name !== undefined) return shown
  const others = commandSegments(command).length - 1
  // The gate a part gets is the first rule it matches, as in judge. A force
  // push beside a lease push is the one to name.
  const gateOf = (segment: string) => {
    const rule = all.find(r => r.target === 'command' && r.pattern.test(segment))
    return rule !== undefined && gates.includes(rule) ? rule : undefined
  }
  const parts = outerParts(command)
  const part = parts.find(p => {
    const gate = gateOf(p.segment)
    return gate !== undefined && neverAlways(gate)
  }) ?? parts.find(p => gateOf(p.segment) !== undefined)
  // A push split over lines with `\` would show as `git push \` alone.
  if (part !== undefined) return { ...shown, head: formatCommand(part.source.replace(/[ \t]*\\\r?\n[ \t]*/g, ' '), zsh).head, others }
  const hit = commandSegments(command).find(s => isGated(gates, s))
  if (hit === undefined) return shown
  return { ...shown, head: hit.trim().replace(/""|''/g, '"…"'), others }
}

// The engine refuses AskUserQuestion through $.tool.call and $.ui.ask has no
// preview box, so the full command goes into the transcript as its own row
// just above the dialog, where it is drawn whole instead of squashed into
// the question line.
async function approve($: EngineInterface, gates: readonly Rule[], shown: Shown, scope: string | undefined, session: string | undefined): Promise<string | undefined> {
  const messages = gates.map(g => g.message).join(' ')
  const canAlways = scope !== undefined && !gates.some(neverAlways)
  const canSession = canAlways && session !== undefined
  $.ui.log(`skill-router asks before running this:\n\n${preview(shown.text)}`)
  let answer: string | undefined
  try {
    // The call is named in the question too: a phone card over Remote
    // Control may show only the dialog, not the log row above it.
    const head = shown.head.slice(0, 200).replaceAll('`', "'")
    const others = shown.others === undefined || shown.others === 0 ? '' : ` and ${shown.others} other command${shown.others === 1 ? '' : 's'}`
    const more = shown.text === shown.head ? '' : ' (full text in the transcript)'
    answer = await $.ui.ask(`${messages} Run \`${head}\`${others}${more}?`, {
      header: 'Approve',
      options: [RUN, ...(canSession ? [SESSION] : []), ...(canAlways ? [ALWAYS] : []), DONT_RUN],
    })
  } catch {
    answer = undefined
  }
  if (answer === undefined) return `${messages} The approval dialog was dismissed, or nobody was here to answer it, so it was not run.`
  if (answer === RUN) return undefined
  if (answer === SESSION && canSession) {
    allowForSession(session, gates)
    return undefined
  }
  if (answer === ALWAYS && canAlways) {
    try {
      await allowGates($, scope, gates)
    } catch {
      $.ui.log('skill-router could not save "always allow"; it will ask again next time.')
    }
    return undefined
  }
  if (answer === DONT_RUN) return `The user did not approve this. ${messages}`
  // Text typed under "Other" is the person's instruction, not a refusal.
  return `Not run. The user answered: "${answer}"`
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await loadRules($)
    await $.command.register({ name: 'gates', description: 'List the approval gates always allowed, or reset them all', argumentHint: '[reset]' })
    return next(e)
  }).catch(($, e, next) => next(e))

  on('command.run', { command: 'gates' }, async ($, e) => {
    let allowed: Map<string, Set<string>>
    let all: Rule[]
    let prefix: string | undefined
    try {
      if (e.args.trim() === 'reset') {
        sessionAllowed.clear()
        await $.store.delete(STORE_KEY)
        return { text: 'every gate asks again, in every project.' }
      }
      allowed = await readAllowed($)
      all = await loadRules($)
      prefix = await $.session.id().then(id => `${id}\n`, () => undefined)
    } catch {
      return { text: 'could not read or reset the allow list.' }
    }
    const list = (from: Map<string, Set<string>>): string[] => {
      const lines: string[] = []
      for (const [scope, ids] of from) {
        const names = all.filter(r => ids.has(ruleId(r))).map(r => `  - ${r.message}`)
        if (names.length > 0) lines.push(scope, ...names)
      }
      return lines
    }
    const always = list(allowed)
    const mine = new Map<string, Set<string>>()
    for (const [key, ids] of sessionAllowed) if (prefix !== undefined && key.startsWith(prefix)) mine.set(key.slice(prefix.length), ids)
    const session = list(mine)
    if (always.length === 0 && session.length === 0) return { text: 'no gates are always allowed.' }
    return {
      text: [
        ...(always.length > 0 ? ['always allowed (/gates reset to undo):', ...always] : []),
        ...(session.length > 0 ? ['allowed for this session:', ...session] : []),
      ].join('\n'),
    }
  })

  // The skill's text is now in this conversation, which is what the block
  // rules ask for. A refusal from below comes back as an error, not a deny;
  // a loaded skill reads "Execute skill: <name>" even where the result is
  // flagged as an error (headless runs), so that text is the tell.
  on('tool.call', { tool: 'Skill' }, async ($, e, next) => {
    const ran = await next(e)
    const isLoaded =
      ran.deny === undefined && (ran.isError !== true || (typeof ran.text === 'string' && ran.text.startsWith('Execute skill:')))
    const skill = isLoaded ? await ruleSkill($, e.skill) : undefined
    if (skill !== undefined) loadedFor(e.agentId).add(skill)
    return ran
  })

  // `/commit` typed by the person loads the skill without the Skill tool.
  on('command.run', async ($, e, next) => {
    const ran = await next(e)
    const skill = await ruleSkill($, e.command)
    if (skill !== undefined) loadedFor(undefined).add(skill)
    return ran
  })

  // A compaction drops the skills' text from that conversation, so they count
  // again only once reloaded. A precompute or a vetoed compaction keeps it.
  on('session.compact', async ($, e, next) => {
    const ran = await next(e)
    if (e.trigger !== 'precompute' && ran.skip === undefined) loaded.delete(e.agentId ?? MAIN)
    return ran
  })
  on('session.end', ($, e, next) => {
    loaded.clear()
    for (const key of sessionAllowed.keys()) if (key.startsWith(`${e.sessionId}\n`)) sessionAllowed.delete(key)
    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    if (e.tool === 'Skill' || e.tool === 'AskUserQuestion') return next(e)
    const all = await loadRules($)
    const command = e.tool === 'Bash' ? e.command : undefined
    let segments: string[] | undefined
    try {
      segments = command === undefined ? undefined : commandSegments(command)
    } catch {
      // Failing open here would run a command whose gates were never checked.
      return { deny: 'skill-router could not split this command into the commands it runs, so it was not run. Run them as separate, simpler calls.' }
    }
    const verdict = segments !== undefined
      ? judge(all, segments, 'command', loadedFor(e.agentId))
      : judge(all, [e.tool], 'tool', loadedFor(e.agentId))

    if (verdict.kind === 'block') {
      return {
        deny: `Invoke the ${listSkills(verdict.missing)} skill with the Skill tool before running this. Once it has loaded in this conversation, the call is allowed.`,
      }
    }
    if (verdict.kind === 'gate') {
      // From here on an error refuses the call: the catch below runs the tool,
      // which would skip a dialog the person never saw.
      let refusal: string | undefined
      try {
        // Without a scope the dialog still asks, just without "always".
        const zsh = command !== undefined && (await runsUnderZsh($))
        const formatted = command !== undefined ? formatCommand(command, zsh) : formatTool(e)
        const scope = await scopeOf($, e, command, formatted, verdict.gates).catch(() => undefined)
        const session = await sessionKey($, scope)
        const allowed = await allowedIn($, scope, session)
        const asking = verdict.gates.filter(g => neverAlways(g) || !allowed.has(ruleId(g)))
        if (asking.length === 0) {
          $.ui.log(`skill-router: allowed in ${scope ?? 'this project'} (/gates to review):\n\n${preview(formatted.text)}`)
        } else {
          const files = command !== undefined ? await bodyFiles($, command, formatted, verdict.gates) : ''
          // Named by a gate still asking, not one already allowed.
          const named = command !== undefined ? gatedHead(formatted, command, all, asking, zsh) : formatted
          refusal = await approve($, asking, { ...named, text: [formatted.text, files].filter(t => t.length > 0).join('\n') }, scope, session)
        }
      } catch (error) {
        refusal = `skill-router could not finish asking about this, so it was not run (${error instanceof Error ? error.message : String(error)}).`
      }
      if (refusal !== undefined) return { deny: refusal }
    }
    return next(e)
  }).catch(($, e, next) =>
    // A broken rules file or a bug must not stop every tool call; the old
    // shell advisor failed open the same way.
    next(e),
  )
}
