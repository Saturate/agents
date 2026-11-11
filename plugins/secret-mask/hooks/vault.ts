import type { Secret } from '../types'

type Detector = {
  label: string
  pattern: RegExp
  // Capture group holding the secret; 0 masks the whole match.
  group: number
}

// Known token formats only. Entropy-only matching was left out because commit
// SHAs, hashes and UUIDs trip it, and a false positive costs an approval prompt.
const DETECTORS: readonly Detector[] = [
  { label: 'private-key', pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, group: 0 },
  { label: 'aws-access-key', pattern: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g, group: 0 },
  { label: 'github-token', pattern: /\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{60,})\b/g, group: 0 },
  { label: 'gitlab-token', pattern: /\bglpat-[A-Za-z0-9_-]{20,}\b/g, group: 0 },
  { label: 'anthropic-key', pattern: /\bsk-ant-[A-Za-z0-9_-]{30,}/g, group: 0 },
  { label: 'openai-key', pattern: /\bsk-(?:proj-)?[A-Za-z0-9_-]{32,}/g, group: 0 },
  { label: 'slack-token', pattern: /\bxox[abposr]-[A-Za-z0-9-]{10,}/g, group: 0 },
  { label: 'stripe-key', pattern: /\b[rs]k_live_[A-Za-z0-9]{24,}/g, group: 0 },
  { label: 'google-api-key', pattern: /\bAIza[0-9A-Za-z_-]{35}\b/g, group: 0 },
  { label: 'jwt', pattern: /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, group: 0 },
  { label: 'azure-account-key', pattern: /AccountKey=([A-Za-z0-9+/=]{40,})/g, group: 1 },
  { label: 'connection-password', pattern: /\b(?:Password|Pwd)=([^;"'\s]{4,})/gi, group: 1 },
  { label: 'url-password', pattern: /\b[a-z][a-z0-9+.-]{0,30}:\/\/[^\s:@/]{1,200}:([^\s@/]{4,})@/gi, group: 1 },
]

// Uppercase env-style names that end in a secret word, optionally quoted as
// JSON keys: `GITHUB_TOKEN=...` and `"DB_PASSWORD": "..."` count, while code
// like `token = getToken()`, `SORT_KEY: 'name'` or `API_KEY_HEADER = ...` does
// not. The value stops at `,` and `;` so a statement's terminator is not
// taken as part of the secret.
const ASSIGNMENT =
  /["']?\b(?=[A-Z])([A-Z0-9_]*(?:SECRET|TOKEN|PASSWORD|PASSWD|_PASS|API_?KEY|ACCESS_?KEY|PRIVATE_?KEY))["']?\s*[=:]\s*["']?([^\s"'#,;]{8,})/g

const PLACEHOLDER = /\{\{SECRET_(\d+)(?::([A-Za-z0-9_-]+))?\}\}/g
const SECRET_TAG = /<secret>([\s\S]*?)<\/secret>/gi

const MIN_DETECTED_LENGTH = 8
// Masking a shorter value everywhere would eat ordinary text ("a", "id").
// A short <secret> is still replaced where it was tagged.
const MIN_GLOBAL_LENGTH = 4
// Shorter encodings would match ordinary text too often.
const MIN_ENCODED_LENGTH = 6

const ENV_LINE = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_.]*)\s*=\s*(.*)$/
// Whole name segments only, so MONKEY_NAME or KEYBOARD_LAYOUT don't count.
// A strong name masks any value that isn't a config word; a weak one
// (APP_KEY, AUTH_MODEL, SESSION_COOKIE) only masks values that look random.
const STRONG_KEY_NAME =
  /(^|_)(SECRET|TOKEN|PASS|PASSWORD|PASSWD|PWD|APIKEY|CREDENTIALS?|DSN|PRIVATE|SALT|SIGNING)(_|$)/i
const WEAK_KEY_NAME = /(^|_)(KEY|AUTH|CERT|COOKIE)(_|$)/i
// Any number of suffixes: .env.production.local is the usual Next.js/Vite name.
const ENV_FILE = /(^|[/\\\s'"])\.env(\.[A-Za-z0-9_-]+)*(?=$|[\s'";|&)>])/
const ENV_EXAMPLE = /\.env(\.[A-Za-z0-9_-]+)*\.(example|sample|template|dist)\b/

export function isEnvFilePath(path: string): boolean {
  return ENV_FILE.test(path) && !ENV_EXAMPLE.test(path)
}

export function mentionsEnvFile(command: string): boolean {
  return ENV_FILE.test(command)
}

function envValue(raw: string): string {
  const trimmed = raw.trim()
  const quoted = /^(["'])(.*?)\1\s*(?:#.*)?$/.exec(trimmed)
  if (quoted) return quoted[2] ?? ''
  return trimmed.replace(/\s+#.*$/, '')
}

// Bits per character. Random tokens sit around 4 and above, words and
// hostnames well under 3.5.
function entropy(value: string): number {
  const counts = new Map<string, number>()
  for (const ch of value) counts.set(ch, (counts.get(ch) ?? 0) + 1)
  let bits = 0
  for (const count of counts.values()) {
    const p = count / value.length
    bits -= p * Math.log2(p)
  }
  return bits
}

// Paths, host names and namespaced identifiers are long and varied but not
// secret; masking a project path breaks file navigation for the session.
function looksLikeLocator(value: string): boolean {
  return (
    // Paths start like one; base64 keys contain `/` mid-value and must not count.
    /^(\/|\.{1,2}\/|~\/|[A-Za-z]:[\\/])/.test(value) ||
    /\\/.test(value) ||
    /^[a-z][a-z0-9+.-]*:\/\//i.test(value) ||
    /^[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+(:\d+)?$/.test(value) ||
    /^[a-z][a-z0-9]*([_-][a-z0-9]+)+$/.test(value)
  )
}

function looksRandom(value: string): boolean {
  return (
    value.length >= 20 &&
    !/\s/.test(value) &&
    /[A-Za-z]/.test(value) &&
    /\d/.test(value) &&
    !looksLikeLocator(value) &&
    entropy(value) >= 4
  )
}

// Config values that sit under secret-sounding keys (SESSION_ENCRYPT=false,
// DB_CONNECTION=sqlite) but would mask ordinary words everywhere if taken.
function looksLikeConfigWord(value: string): boolean {
  return (
    value.length < 8 ||
    /^(true|false|null|none|nil|yes|no|on|off|enabled|disabled)$/i.test(value) ||
    /^-?\d+(\.\d+)?$/.test(value) ||
    (/^[a-z]+$/.test(value) && value.length < 12)
  )
}

// `os.environ.get("X")`, `process.env.X` and `getpass()` sit under secret
// names in code all the time; taking them would mask that code everywhere.
// The value is cut at the first quote, so `getenv("X")` arrives as `getenv(`.
// A password that merely contains a bracket must still count as a secret.
function looksLikeCode(value: string): boolean {
  return (
    /^[A-Za-z_$][\w$]*(\.[A-Za-z_$][\w$]*)+$/.test(value) ||
    /^[A-Za-z_$][\w$]*(\.[A-Za-z_$][\w$]*)+[([]/.test(value) ||
    // Letters only before the bracket, so `Passw0rdX(` stays a secret.
    /^[A-Za-z_$][A-Za-z_$]*[([]$/.test(value) ||
    /^[A-Za-z_$][\w$]*\(\)$/.test(value)
  )
}

function looksLikePlaceholderValue(value: string): boolean {
  return (
    /^[$<{%]/.test(value) ||
    /example|changeme|placeholder|your[_-]|xxxx|\*\*\*\*/i.test(value) ||
    /^(.)\1+$/.test(value) ||
    value.includes('{{SECRET_')
  )
}

function encodings(value: string): Array<[string, string]> {
  const bytes = new TextEncoder().encode(value)
  const binary = Array.from(bytes, b => String.fromCharCode(b)).join('')
  const base64 = btoa(binary)
  const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
  return [
    ['base64', base64],
    ['base64', base64.replace(/=+$/, '')],
    ['base64url', base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')],
    ['hex', hex],
    ['hex', hex.toUpperCase()],
    ['reversed', [...value].reverse().join('')],
    ['url', encodeURIComponent(value)],
  ]
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function placeholderFor(secret: Secret): string {
  return `{{SECRET_${secret.n}:${secret.label}}}`
}

type Matcher = { pattern: RegExp; replacements: Map<string, string> }

export class Vault {
  private secrets: Secret[] = []
  private dirty = false
  private matcher: Matcher | undefined

  load(list: readonly Secret[]): void {
    this.secrets = list.map(s => ({ ...s }))
    this.matcher = undefined
  }

  list(): readonly Secret[] {
    return this.secrets
  }

  // True once since the last call when a secret was added or changed, so the
  // caller knows to persist.
  takeDirty(): boolean {
    const was = this.dirty
    this.dirty = false
    return was
  }

  byNumber(n: number): Secret | undefined {
    return this.secrets.find(s => s.n === n)
  }

  allow(n: number): void {
    const secret = this.byNumber(n)
    if (secret && !secret.isAllowed) {
      secret.isAllowed = true
      this.dirty = true
    }
  }

  private add(value: string, label: string, isAllowed: boolean): Secret {
    const existing = this.secrets.find(s => s.value === value)
    if (existing) return existing
    const n = this.secrets.reduce((max, s) => Math.max(max, s.n), 0) + 1
    const secret: Secret = { n, value, label: label.slice(0, 40), isAllowed }
    this.secrets.push(secret)
    this.dirty = true
    this.matcher = undefined
    return secret
  }

  detect(text: string): void {
    for (const d of DETECTORS) {
      for (const m of text.matchAll(d.pattern)) {
        const value = m[d.group]
        if (value && value.length >= MIN_DETECTED_LENGTH && !looksLikePlaceholderValue(value)) {
          this.add(value, d.label, false)
        }
      }
    }
    for (const m of text.matchAll(ASSIGNMENT)) {
      const name = m[1]
      const value = m[2]
      if (name && value && !looksLikePlaceholderValue(value) && !looksLikeConfigWord(value) && !looksLikeCode(value)) {
        this.add(value, name.toLowerCase().replace(/_/g, '-'), false)
      }
    }
  }

  detectEnvFile(text: string): void {
    for (const line of text.split(/\r?\n/)) {
      const m = ENV_LINE.exec(line)
      const name = m?.[1]
      const value = m?.[2] === undefined ? '' : envValue(m[2])
      if (!name || value.length < MIN_GLOBAL_LENGTH || looksLikePlaceholderValue(value)) continue
      const isStrong = STRONG_KEY_NAME.test(name) && !looksLikeConfigWord(value)
      const isWeak = WEAK_KEY_NAME.test(name) && !looksLikeConfigWord(value) && !looksLikeLocator(value)
      if (isStrong || (isWeak && value.length >= 16) || looksRandom(value)) {
        this.add(value, name.toLowerCase().replace(/[_.]/g, '-'), false)
      }
    }
  }

  // One alternation over every value and its encodings, longest first, run
  // in a single pass. Replacing one value at a time would rescan placeholders
  // already inserted and nest a short value inside them.
  private compile(): Matcher | undefined {
    const replacements = new Map<string, string>()
    for (const s of this.secrets) {
      if (s.value.length < MIN_GLOBAL_LENGTH) continue
      if (!replacements.has(s.value)) replacements.set(s.value, placeholderFor(s))
    }
    for (const s of this.secrets) {
      if (s.value.length < MIN_GLOBAL_LENGTH) continue
      for (const [kind, encoded] of encodings(s.value)) {
        // The second colon keeps these markers from ever matching PLACEHOLDER,
        // so an encoded copy can never be unmasked.
        if (encoded.length >= MIN_ENCODED_LENGTH && !replacements.has(encoded)) {
          replacements.set(encoded, `{{SECRET_${s.n}:${s.label}:${kind}}}`)
        }
      }
    }
    if (replacements.size === 0) return undefined
    const alternation = [...replacements.keys()]
      .sort((a, b) => b.length - a.length)
      .map(escapeRegExp)
      .join('|')
    return { pattern: new RegExp(alternation, 'g'), replacements }
  }

  maskKnown(text: string): string {
    this.matcher ??= this.compile()
    const matcher = this.matcher
    if (!matcher) return text
    return text.replace(matcher.pattern, found => matcher.replacements.get(found) ?? found)
  }

  containsSecret(text: string, options: { isEnvFile: boolean }): boolean {
    if (this.maskKnown(text) !== text) return true
    const probe = new Vault()
    probe.detect(text)
    if (options.isEnvFile) probe.detectEnvFile(text)
    return probe.list().length > 0
  }

  // A value the user hands over on purpose (<secret>, /mask) is pre-allowed:
  // Claude can use it without a prompt, it just never sees it.
  addUser(value: string): Secret {
    return this.add(value, 'user', true)
  }

  maskPrompt(text: string): string {
    const tagged = text.replace(SECRET_TAG, (_, value: string) =>
      value.length > 0 ? placeholderFor(this.addUser(value)) : '',
    )
    this.detect(tagged)
    return this.maskKnown(tagged)
  }

  placeholdersIn(text: string): number[] {
    const found = new Set<number>()
    for (const m of text.matchAll(PLACEHOLDER)) {
      const secret = this.resolve(m[1], m[2])
      if (secret) found.add(secret.n)
    }
    return [...found]
  }

  unmask(text: string): string {
    return text.replace(PLACEHOLDER, (whole, digits: string, label: string | undefined) => this.resolve(digits, label)?.value ?? whole)
  }

  // A labelled placeholder only resolves when the label matches, so text that
  // merely looks like a placeholder (docs, tests, another session's numbering)
  // is not swapped for an unrelated secret.
  private resolve(digits: string | undefined, label: string | undefined): Secret | undefined {
    const secret = this.byNumber(Number(digits))
    if (!secret || (label !== undefined && label !== secret.label)) return undefined
    return secret
  }
}

export function rewriteStrings(node: unknown, rewrite: (s: string) => string): void {
  if (Array.isArray(node)) {
    node.forEach((item, i) => {
      if (typeof item === 'string') node[i] = rewrite(item)
      else rewriteStrings(item, rewrite)
    })
    return
  }
  if (node !== null && typeof node === 'object') {
    for (const [key, value] of Object.entries(node)) {
      if (typeof value === 'string') Reflect.set(node, key, rewrite(value))
      else rewriteStrings(value, rewrite)
    }
  }
}

export function visitStrings(node: unknown, visit: (s: string) => void): void {
  rewriteStrings(structuredClone(node), s => {
    visit(s)
    return s
  })
}
