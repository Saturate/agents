export type Rule = {
  kind: 'block' | 'gate'
  // `command` rules match a Bash command; `tool` rules match a tool's name.
  target: 'command' | 'tool'
  pattern: RegExp
  // Skills a block needs loaded; for a gate, its name.
  skills: readonly string[]
  message: string
}

const ACTIONS: Readonly<Record<string, Pick<Rule, 'kind' | 'target'>>> = {
  block: { kind: 'block', target: 'command' },
  gate: { kind: 'gate', target: 'command' },
  'block-tool': { kind: 'block', target: 'tool' },
  'gate-tool': { kind: 'gate', target: 'tool' },
}

// The rules file is written for `grep -E`, which knows POSIX classes and JS
// does not. The generated diagram reads the same file, so it keeps that form.
function toJsRegex(pattern: string): RegExp {
  return new RegExp(pattern.replace(/\[:space:\]/g, '\\s').replace(/\[:alpha:\]/g, 'A-Za-z').replace(/\[:digit:\]/g, '0-9'))
}

export function parseRules(text: string): Rule[] {
  const rules: Rule[] = []
  for (const line of text.split(/\r?\n/)) {
    if (line.trim() === '' || line.startsWith('#')) continue
    const [action = '', pattern = '', skills = '', message = ''] = line.split('\t')
    const shape = ACTIONS[action]
    if (!shape || pattern === '' || skills === '') continue
    let compiled: RegExp
    try {
      compiled = toJsRegex(pattern)
    } catch {
      // One broken pattern must not take every other rule down with it.
      continue
    }
    rules.push({
      ...shape,
      pattern: compiled,
      skills: skills.split(',').map(s => s.trim()).filter(s => s.length > 0),
      message: message.trim(),
    })
  }
  return rules
}

const PREFIXES = [
  /^[({!]\s*/,
  /^(?:then|do|else|elif|if|while|until)\s+/,
  // `\git` skips an alias and `/usr/bin/git` names the binary; both are git.
  /^\\(?=[A-Za-z])/,
  /^\/?(?:[\w.-]+\/)+(?=[\w.-]+(?:\s|$))/,
  // Environment assignments: FOO=bar git commit
  /^[A-Za-z_][A-Za-z0-9_]*=(?:'[^']*'|"[^"]*"|\S*)\s+/,
  /^(?:sudo|command|exec|time|nohup|env)\s+/,
]

// `git -C ../repo commit` is still a commit.
const GIT_GLOBAL_OPTIONS = /^git(?:\s+(?:-C\s+\S+|-c\s+\S+|--no-pager|--git-dir=\S+|--work-tree=\S+))+(?=\s)/

function stripPrefixes(segment: string): string {
  let out = segment.trim()
  for (let changed = true; changed; ) {
    changed = false
    for (const prefix of PREFIXES) {
      const next = out.replace(prefix, '')
      if (next !== out) {
        out = next.trim()
        changed = true
      }
    }
  }
  return out.replace(GIT_GLOBAL_OPTIONS, 'git')
}

// Index of the `)` closing the `(` at `open`, or the end of the text.
function closingParen(text: string, open: number): number {
  let depth = 0
  for (let i = open; i < text.length; i++) {
    const c = text[i]
    if (c === '\\') i++
    else if (c === '(') depth++
    else if (c === ')' && --depth === 0) return i
  }
  return text.length
}

// Quoted text is blanked so a commit message is never read as a command. A
// command substitution, quoted or not, still runs, so its body is kept as
// commands of its own and the text around it stays one word: splitting at
// `$(` would cut `PATH=$(pwd)/bin git push` into pieces that match nothing.
// One left-to-right pass, because an apostrophe inside double quotes must not
// pair with a later single quote.
function blankQuotes(text: string): { outer: string; inner: string[] } {
  let outer = ''
  const inner: string[] = []
  for (let i = 0; i < text.length; ) {
    const c = text[i]
    if (c === '\\' && /^\r?\n/.test(text.slice(i + 1, i + 3))) {
      // A backslash-newline continues the command, so `git push \` with
      // `--force` on the next line is one force push. Handled here rather
      // than up front so an escaped `\\` at a line end still ends the line.
      outer += ' '
      i += text[i + 1] === '\r' ? 3 : 2
    } else if (c === '\\') {
      outer += text.slice(i, i + 2)
      i += 2
    } else if (text.startsWith('$(', i)) {
      const close = closingParen(text, i + 1)
      inner.push(text.slice(i + 2, close))
      outer += '""'
      i = close + 1
    } else if (c === '`') {
      const close = text.indexOf('`', i + 1)
      inner.push(text.slice(i + 1, close === -1 ? text.length : close))
      outer += '""'
      i = close === -1 ? text.length : close + 1
    } else if (c === "'") {
      const end = text.indexOf("'", i + 1)
      outer += "''"
      i = end === -1 ? text.length : end + 1
    } else if (c === '"') {
      let j = i + 1
      while (j < text.length && text[j] !== '"') {
        if (text[j] === '\\') {
          j += 2
        } else if (text.startsWith('$(', j)) {
          const close = closingParen(text, j + 1)
          inner.push(text.slice(j + 2, close))
          j = close + 1
        } else if (text[j] === '`') {
          const close = text.indexOf('`', j + 1)
          inner.push(text.slice(j + 1, close === -1 ? text.length : close))
          j = close === -1 ? text.length : close + 1
        } else {
          j++
        }
      }
      outer += '""'
      i = j + 1
    } else {
      outer += c
      i++
    }
  }
  return { outer, inner }
}

// Past this many nested substitutions the rest is not split further; only a
// deliberately odd command gets there, and recursing on would blow the stack.
const MAX_DEPTH = 20

// Splits a Bash command into the simple commands it runs, so each one is
// matched on its own. Heredoc bodies are dropped first: a commit message
// whose body has a line starting with `git push` is not a push. The rest of
// the line that opens the heredoc still runs, so it is kept.
function split(command: string): { parts: string[]; inner: string[] } {
  const withoutHeredocs = command.replace(
    /<<-?\s*(['"]?)([A-Za-z_][A-Za-z0-9_]*)\1([^\n]*)\n[\s\S]*?\n\s*\2(?=\n|$)/g,
    (_whole: string, _quote: string, _word: string, rest: string) => ` ${rest}`,
  )
  const { outer, inner } = blankQuotes(withoutHeredocs)
  return { parts: outer.split(/\|\||&&|[;|&\n]|[()]/), inner }
}

// The rules are written in lower case. A case-insensitive filesystem (macOS)
// runs `GIT` as git, and Azure CLI lowercases its command words (`az REPOS PR
// UPDATE`), so those are matched in lower case too.
function canonical(segment: string): string {
  const words = segment.split(/(\s+)/)
  const az = (words[0] ?? '').toLowerCase() === 'az'
  let commandWords = true
  return words
    .map((word, i) => {
      if (i === 0) return word.toLowerCase()
      if (!az || !commandWords || /^\s+$/.test(word)) return word
      if (word.startsWith('-')) commandWords = false
      return commandWords ? word.toLowerCase() : word
    })
    .join('')
}

export function commandSegments(command: string, depth = 0): string[] {
  const { parts, inner } = split(command)
  const segments = parts.map(stripPrefixes).map(canonical).filter(segment => segment.length > 0)
  if (depth >= MAX_DEPTH) return segments
  return [...segments, ...inner.flatMap(body => commandSegments(body, depth + 1))]
}

// The commands of the call itself, without the bodies of `$(...)`, each with
// its prefixes (`FOO=bar`, `env`, `sudo`) still on: the scope check treats
// any of those as a reason to ask.
export function outerSegments(command: string): string[] {
  return split(command)
    .parts.map(part => part.trim())
    .filter(part => part.length > 0)
}

// The skill name as rules write it: `plugin:skill` loads `skill`.
export function skillName(name: string): string {
  return name.split(':').pop() ?? name
}

export type Verdict =
  | { kind: 'allow' }
  | { kind: 'block'; missing: readonly string[] }
  | { kind: 'gate'; gates: readonly Rule[] }

// A rule's identity for "always allow": its pattern, so allowing
// `gh issue create` doesn't also allow the other draft-first rules.
export function ruleId(rule: Rule): string {
  return rule.pattern.source
}

// First matching rule wins per segment, so a force push gets the destructive
// gate rather than the push skill. Blocks win over gates: no point asking the
// person to approve a command the model isn't ready to run.
export function judge(rules: readonly Rule[], targets: readonly string[], target: Rule['target'], loaded: ReadonlySet<string>): Verdict {
  const missing = new Set<string>()
  const gates: Rule[] = []
  for (const text of targets) {
    const rule = rules.find(r => r.target === target && r.pattern.test(text))
    if (!rule) continue
    if (rule.kind === 'block') {
      for (const skill of rule.skills) if (!loaded.has(skill)) missing.add(skill)
    } else if (!gates.includes(rule)) {
      gates.push(rule)
    }
  }
  if (missing.size > 0) return { kind: 'block', missing: [...missing] }
  if (gates.length > 0) return { kind: 'gate', gates }
  return { kind: 'allow' }
}
