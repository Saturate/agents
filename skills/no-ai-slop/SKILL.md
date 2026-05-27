---
name: no-ai-slop
description: "Guides prose writing to avoid AI-generated slop patterns. Applies structural variety, voice authenticity, and a multi-step self-review with worked examples."
when_to_use: "Use when writing a blog post, drafting an article, editing long-form text, reviewing prose for AI tells, content writing, documentation prose, or any writing task beyond short responses."
user-invocable: true
---

# No AI Slop Writing

The hard bans (em dashes, banned words, filler transitions) live in CLAUDE.md and apply to all output. This skill adds the craft layer: structural variety, voice, depth, and a full self-review pass. Use it when writing anything longer than a few paragraphs.

Full banned-word reference with alternatives: [references/ai-writing-detection.md](references/ai-writing-detection.md)
Sources for deeper analysis or self-update: [references/sources.md](references/sources.md)

## Sentence-level patterns to avoid

- **"The fix? <answer>" / "The result? <answer>"** Rhetorical question answered immediately. Ask a real question or make the statement.
- **Staccato fragment chains** "That's the problem. The real problem. The one nobody talks about." Once in a piece, maybe. Twice, flagged.
- **Rule of three** "Fast, efficient, and reliable." LLMs default to triads. Two items or four break the pattern.
- **Unearned profundity** "Something shifted." / "Everything changed." / "Let that sink in." If the preceding paragraph didn't earn it, cut it.
- **Acknowledge-pivot-escalate** "They're not wrong. But here's the thing:" Once per article max.
- **Present-participle padding** Dangling -ing clauses tacked onto sentences as filler analysis: "highlighting the need for reform", "ensuring long-term sustainability." Cut them.
- **Synonym cycling** Rotating through synonyms for the same concept to avoid repetition. Repeating a word is fine; forced variation ("endpoint", "route", "API path", "URL") hurts clarity.
- **Copula-avoidance verbs** "stands as", "serves as", "represents", "boasts", "offers" replacing simple "is" or "has". Just use "is."
- **Vague attribution** "Experts argue", "Industry reports suggest", "Some critics say." Name the expert or cut the claim.
- **"Whether you're"** Never start a sentence with "Whether you're a [X], [Y], or [Z]."
- **Performative urgency** "Act now" needs a concrete consequence (a real deadline, a real penalty) in the same sentence or it gets cut.
- **Synthetic enthusiasm** No exclamation marks or cheerleading. State the facts.
- **Scare quotes** Use quotation marks only for actual quotations from a named source.
- **Reference narration** Don't write "as discussed above" or "as we will see." Make the connection and move on.
- **Repeated talking points** Say it once. Duplicates are padding.

## Structural rules

- **No symmetric sections.** If you have four sections, they must not all be the same length and structure. Real thinking is uneven.
- **Vary paragraph length.** Some paragraphs should be one sentence. Others should run long. Monotonous cadence reads as machine output.
- **No closing with bulleted "big questions."** That's the model running out of depth and defaulting to provocative prompts.
- **No section summaries.** Don't end a section with a paragraph restating what the section just said. Move forward.
- **No repeated section openers.** Check the first line of every section. If they follow the same pattern, rewrite.
- **No emoji as structure.** No emoji prefixes on bullet points, no emoji section markers. Emoji is ornament, not formatting.
- **Spread zingers thin.** "You can't patch architecture." If someone would quote it on LinkedIn, you can keep one. Cut the rest.
- **No parenthetical clarifications in headings.** Trust the reader.

## Integrity rules

- **No unsourced statistics.** Every number must be real and attributable. If you cannot point to where it comes from, do not write it. A made-up figure is worse than no figure.
- **No fabricated case studies.** Never write narrative scenarios presented as real events unless describing a specific, documented incident.
- **No fabricated history.** Do not invent dates for events, launches, milestones. Every date and event must be real.
- **Quote sources accurately.** Every word inside quotation marks must match the source exactly. Do not correct grammar or swap pronouns. Mark changes with square brackets; if wording is awkward, paraphrase without quotation marks.
- **No research-process narration.** Do not narrate what you searched for and failed to find ("could not be located", "was not found", "no record was found"). If a fact cannot be supported, delete it silently. Do not tell the reader you looked.

## Content depth rules

- **Depth over breadth.** Cover 3 things with real substance, not 10 at medium depth. LLMs optimize for coverage. Humans go deep.
- **Engage with sources.** Don't drop a link without discussing what it says. Cite fewer things but actually argue with them.
- **No research dumps.** Five bullet points of percentages and dollar amounts reads like RAG output. Weave evidence into narrative.
- **Don't present common knowledge as revelation.** If the audience knows it, don't frame it with authority as though it's new.
- **Commit to positions.** "I think X is wrong" not "While X has its merits, there are also considerations that suggest Y." Real writers have opinions someone could disagree with.
- **Show the struggle.** What you tried that didn't work, what confused you, where you changed your mind. No "just product, no struggle."

## What reads as human

- Lead with specific experience. Personal anecdotes and war stories are the strongest authenticity signal. Claude defaults to omitting these; always ask for or include them.
- Trust the reader. One analogy, no explanation of what the analogy means. Technical audiences already know the basics; don't frame established practices as revelations.
- Varied tone within the piece. Funny, then serious, then technical, then casual. LLMs hold a consistent register.
- Specific cultural references. Inside jokes, niche references, low-frequency training data.
- Coin your own terms. Original phrases that don't exist in training data.

## Worked examples

### No intensifiers

- WRONG: "The pricing was significantly higher than the cost of the part."
- RIGHT: "They charged $1,200 for a repair that needed a $5 chip."

### No hollow statements

- WRONG: "This practice has had a significant impact on people."
- RIGHT: "The company replaced 11 million batteries in 2018, against the 1 to 2 million it had expected."

### No filler openers

- WRONG: "In today's world, planned obsolescence affects many devices."
- RIGHT: "Apple, Samsung, and Google have each faced lawsuits alleging planned obsolescence."

### No weasel words

- WRONG: "Serialization may potentially prevent independent repair."
- RIGHT: "Replacing an iPhone 15 camera module without the manufacturer's calibration software disables optical image stabilization."

### No dramatic headings

- WRONG: "The Hidden Cost of Planned Obsolescence"
- RIGHT: "Economic impact of shortened product lifespans"

### No structural repetition

WRONG (three identical shapes):
```
In [year], [party] did [thing]. This affected [number] people. [Party] responded by [action].
In [year], [party] did [thing]. This affected [number] people. [Party] responded by [action].
In [year], [party] did [thing]. This affected [number] people. [Party] responded by [action].
```

RIGHT (varied shapes):
```
Section one: detailed narrative with timeline across two paragraphs.
Section two: two-sentence summary, because the event is thinly documented.
Section three: opens with the party's justification, then the contradicting evidence.
```

### No fabricated attributions

Never put a position in a named person's mouth from inference. State only what they actually did or said, with the real source.

- WRONG: "Senator Smith has argued that the right to repair is essential."
- RIGHT: "Senator Smith co-sponsored the Fair Repair Act in January 2024."

### Researcher, not copywriter

- WRONG: "People deserve the right to repair their own devices."
- RIGHT: "The FTC voted 5-0 in July 2021 to step up enforcement against illegal repair restrictions."

### Root-cause differentiation

When contrasting two things, name the concrete difference. Do not assert one is exempt, newer, or unaffected without the mechanism.

- WRONG: "2020+ Leaf models are unaffected and use the MyNISSAN app instead."
- RIGHT: "2020+ Leaf models shipped with 4G/LTE telematics units connected to a newer cloud platform, replacing the 2G/3G units in earlier models."

## Self-review pass

Run this on every piece of prose before returning it. Scan against [references/ai-writing-detection.md](references/ai-writing-detection.md) for the full banned lists with alternatives.

1. Search for em dash (—). Remove every one.
2. Scan for banned verbs, adjectives, transitions, academic tells, and inflated symbolism phrases from the reference file. Replace with plain equivalents.
3. Scan for filler words and empty intensifiers. Cut or replace with evidence.
4. Scan for banned openers, transitional phrases, and concluding phrases.
5. Check every number: is it real and attributable? If not, cut it.
6. Check every sentence ends on a concrete detail, not an assertion of importance.
7. Check headings: does each name content rather than tease it? Run against heading anti-patterns in reference file.
8. Check for repeated section shapes and repeated points.
9. Count "It's not X, it's Y" constructions. More than two in 500 words? Rewrite.
10. Count em dashes again (they creep back in). More than zero? Fix.
11. Are sections roughly the same length? Make them asymmetric.
12. Count hedging markers per paragraph. More than 3 per paragraph or 8 per 1000 words is a flag.
13. Did you hedge every position? Pick at least one hill to die on.
14. Check for hallucinated markup artifacts (oaicite, contentReference, turn0search0, grok_card).
15. Read it aloud. If every paragraph has the same rhythm, break some.
16. Would someone quote your one-liners on LinkedIn? If yes, cut half of them.
17. If any step flagged an issue, fix it and run the full pass again. Only return prose when all checks pass clean.

