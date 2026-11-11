import type { EngineInterface, Register } from 'claude-code'

import { commandSegments, judge, parseRules, skillName } from './rules'
import type { Rule } from './rules'

const MAIN = 'main'
const PREVIEW_LIMIT = 1500
const RUN = 'Run it'
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

async function approve($: EngineInterface, messages: readonly string[], shown: string): Promise<string | undefined> {
  let answer: string
  try {
    answer = await $.ui.ask(`${messages.join(' ')}\n\n${preview(shown)}\n\nRun it?`, { header: 'Approve', options: [RUN, DONT_RUN] })
  } catch {
    return `${messages.join(' ')} The approval dialog was dismissed, or nobody was here to answer it, so it was not run.`
  }
  if (answer === RUN) return undefined
  if (answer === DONT_RUN) return `The user did not approve this. ${messages.join(' ')}`
  // Text typed under "Other" is the person's instruction, not a refusal.
  return `Not run. The user answered: "${answer}"`
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await loadRules($)
    return next(e)
  }).catch(($, e, next) => next(e))

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
    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    if (e.tool === 'Skill' || e.tool === 'AskUserQuestion') return next(e)
    const all = await loadRules($)
    const isBash = e.tool === 'Bash'
    const verdict = isBash
      ? judge(all, commandSegments(e.command), 'command', loadedFor(e.agentId))
      : judge(all, [e.tool], 'tool', loadedFor(e.agentId))

    if (verdict.kind === 'block') {
      return {
        deny: `Invoke the ${listSkills(verdict.missing)} skill with the Skill tool before running this. Once it has loaded in this conversation, the call is allowed.`,
      }
    }
    if (verdict.kind === 'gate') {
      const refusal = await approve($, verdict.messages, isBash ? e.command : JSON.stringify(e, null, 2))
      if (refusal !== undefined) return { deny: refusal }
    }
    return next(e)
  }).catch(($, e, next) =>
    // A broken rules file or a bug must not stop every tool call; the old
    // shell advisor failed open the same way.
    next(e),
  )
}
