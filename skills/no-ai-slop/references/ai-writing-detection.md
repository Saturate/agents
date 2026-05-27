# AI Writing Detection

Banned words, phrases, punctuation patterns, structural signals, and statistical measures associated with AI-generated text. Scan all prose output against this file during self-review.

## Contents
- Em Dashes
- Overused Verbs
- Overused Adjectives
- Overused Metaphorical Nouns
- Overused Transitions and Connectors
- Phrases That Signal AI Writing
- Filler Words and Empty Intensifiers
- Heading Anti-Patterns
- Academic-Specific AI Tells
- Hallucinated Markup Artifacts
- Hedging and Epistemic Modality Overload
- Structural and Statistical Patterns
- Model-Family-Specific Tells
- False Positive Prevention

## Em Dashes

The em dash is banned. Use a semicolon, period, comma, or restructure.

| Instead of | Use |
|---|---|
| The results—which were surprising—showed... | The results, which were surprising, showed... |
| This approach—unlike traditional methods—allows... | This approach, unlike traditional methods, allows... |
| The study found—as expected—that... | The study found, as expected, that... |
| Communication skills—both written and verbal—are essential | Communication skills (both written and verbal) are essential |

## Overused Verbs

| Avoid | Use instead |
|---|---|
| delve (into) | explore, examine, investigate, look at |
| leverage | use, apply, draw on |
| optimise | improve, refine |
| utilise | use |
| facilitate | help, enable, support |
| foster | encourage, support, develop |
| bolster | strengthen, support, reinforce |
| underscore | highlight, stress |
| unveil | reveal, show, introduce |
| navigate (metaphorical) | manage, handle, work through |
| streamline | simplify, make more efficient |
| enhance | improve, strengthen |
| endeavour | try, attempt |
| ascertain | find out, determine |
| elucidate | explain, clarify |

## Overused Adjectives

| Avoid | Use instead |
|---|---|
| robust | strong, reliable, solid |
| comprehensive | complete, thorough, full |
| pivotal | key, critical, central |
| crucial | important, key, essential |
| vital | important, essential |
| transformative | significant, major |
| cutting-edge | new, advanced, modern |
| groundbreaking | new, original, significant |
| innovative | new, original, creative |
| seamless | smooth, easy, effortless |
| intricate | complex, detailed |
| nuanced | subtle, complex |
| multifaceted | complex, varied |
| holistic | complete, whole |

## Overused Metaphorical Nouns

Only flag metaphorical uses. Literal uses are fine.

| Avoid (metaphorical) | OK (literal) |
|---|---|
| tapestry ("a tapestry of regulations") | tapestry (actual woven fabric) |
| symphony ("a symphony of features") | symphony (actual musical composition) |
| beacon ("a beacon of hope") | beacon (actual light or signal) |
| realm ("in the realm of cybersecurity") | realm (actual kingdom or territory) |
| testament ("a testament to innovation") | testament (actual legal document) |

## Overused Transitions and Connectors

| Avoid | Use instead |
|---|---|
| furthermore | also, and |
| moreover | also, and, besides |
| notwithstanding | despite, still |
| that being said | however, but, still |
| at its core | basically |
| to put it simply | in short |
| it is worth noting that | note that |
| in the realm of | in, within |
| in the landscape of | in, within |
| in today's [anything] | currently, now, today |

## Phrases That Signal AI Writing

### Opening phrases
- "In today's fast-paced world..."
- "In today's digital age..."
- "In an era of..."
- "In the ever-evolving landscape of..."
- "In the realm of..."
- "It's important to note that..."
- "Let's delve into..."
- "Imagine a world where..."

### Transitional phrases
- "That being said..."
- "With that in mind..."
- "It's worth mentioning that..."
- "At its core..."
- "To put it simply..."
- "In essence..."
- "This begs the question..."

### Concluding phrases
- "In conclusion..."
- "To sum up..."
- "By [doing X], you can [achieve Y]..."
- "In the final analysis..."
- "All things considered..."
- "At the end of the day..."

### Structural patterns
- "Whether you're a [X], [Y], or [Z]..."
- "It's not just [X], it's also [Y]..."
- "Think of [X] as [elaborate metaphor]..."
- Starting sentences with "By" + gerund: "By understanding X, you can Y..."
- "It's not X. It's Y." / "It's not about X, it's about Y." More than two in 500 words is a high-confidence AI indicator.

### Inflated symbolism phrases (frequency multipliers vs human baseline)
- "provide a valuable insight" (468x more frequent in AI text)
- "left an indelible mark" (317x)
- "play a significant role in shaping" (207x)
- "an unwavering commitment" (202x)
- "open a new avenue" (174x)
- "a stark reminder" (166x)
- "gain a comprehensive understanding" (120x)
- "serves as a testament"
- "watershed moment"
- "deeply rooted"

## Filler Words and Empty Intensifiers

Remove or replace with evidence:

absolutely, actually, basically, certainly, clearly, definitely, essentially, extremely, fundamentally, incredibly, interestingly, naturally, obviously, quite, really, significantly, simply, surely, truly, ultimately, undoubtedly, very

## Heading Anti-Patterns

| Pattern | Bad | Good |
|---|---|---|
| "The [Concept] Trap" | "The Initialization Trap" | "Import vs. Initialize: DDF Metadata Destruction Risk" |
| "The [Adjective] [Noun]" drama | "The Hidden Danger" | "Firmware Corruption After Sudden Power Loss" |
| "The [Noun] [Dramatic Noun]" | "The Silent Killer" | "Gradual Bad Sector Growth on Aging Platters" |
| "Why [Action] [Dramatic Verb]" | "Why Rebuilding Destroys Everything" | "How Forced Rebuilds Overwrite Parity on Degraded Arrays" |
| "[Noun]: The [Adjective] [Noun]" | "Encryption: The Hidden Trap" | "Hardware AES-256 Encryption on WD Passport Bridge Boards" |
| "The [Noun] You [Emotion Verb]" | "The Risk You Overlook" | "Unmonitored SMART Threshold Warnings" |

Self-check: Could this heading be a thriller chapter title or YouTube clickbait? If yes, rewrite. A heading reads like a technical manual index entry.

## Academic-Specific AI Tells

| Avoid | Use instead |
|---|---|
| shed light on | clarify, explain, reveal |
| pave the way for | enable, allow |
| a myriad of | many, various |
| a plethora of | many, several |
| paramount | very important, essential |
| pertaining to | about, regarding |
| prior to | before |
| subsequent to | after |
| in light of | because of, given |
| with respect to | about, regarding |
| in terms of | regarding, for, about |
| the fact that | that (or rewrite sentence) |

## Hallucinated Markup Artifacts

100% confidence indicators of unedited AI output:

| Artifact | Origin |
|---|---|
| `oaicite` | OpenAI ChatGPT citation placeholder |
| `contentReference` | OpenAI internal reference tag |
| `grok_card` | xAI Grok citation tag |
| `attributableIndex` | AI attribution tracking artifact |
| `turn0search0` | ChatGPT search result placeholder |

## Hedging and Epistemic Modality Overload

AI models hedge 4-7x more than human writers.

### Hedging markers
- **Epistemic modals** (45% of AI hedges): may, might, could, potentially
- **Cognitive verbs** (25%): I think, I believe, it seems, it appears
- **Adverbs of limitation** (20%): probably, generally, usually, arguably, likely
- **Explicit uncertainty**: unclear, remains to be seen, further research is needed

### Thresholds
- **Per paragraph:** >3 hedging instances warrants scrutiny
- **Per 1000 words:** >8 hedging markers in declarative sections (background, history, timeline) indicates AI generation
- **Exception:** Sections about pending legislation, ongoing litigation, or genuinely disputed facts should hedge

### AI hedging phrases
- "It is worth noting that..."
- "It should be noted that..."
- "One could argue that..."
- "While X, Y remains..."
- "Though precise thresholds can vary depending on..."
- "It is widely acknowledged that..."

## Structural and Statistical Patterns

### Paragraph length uniformity
AI paragraphs tend toward identical sentence counts (3-4 each). If all paragraphs in a section are within 15% word count of each other, the section is likely AI-generated.

### Sentence length uniformity (burstiness)
Human writing alternates short punchy sentences with long clause-heavy ones. AI clusters around 15-20 words. If a 500-word block has no sentences under 8 words or over 30 words, it lacks human burstiness.

### Transition density
If >30% of paragraphs begin with a transition word or adverbial clause, the text is structurally artificial.

### Opening-word repetition
3+ consecutive paragraphs starting with the same word or phrase pattern indicates mechanical generation.

### Segmental entropy
AI maintains flat stylistic consistency from intro through conclusion. Human intros are tighter, body sections denser, conclusions shift register. If sentence length variance differs by <10% across intro/body/conclusion, it was likely single-pass AI.

### Contrasting parallelism overuse
"It's not X, it's Y." / "It's not about X, it's about Y." / "The issue isn't X. The issue is Y." More than two in 500 words is a flag.

## Model-Family-Specific Tells

### GPT-4o / GPT-4.5
- Heavy bullet-point formatting and structured lists
- Staccato contrasting: "It's not X. It's Y."
- Rhetorical colon abuse: "Here's the thing:", "The bottom line:", "The reality:"
- Over-structures arguments into numbered steps

### Claude 3.5 / Claude 4
- Better sentence length variation than GPT, but flat segmental entropy
- Overly conciliatory transitions: "It's worth considering that", "To be fair", "That said"
- Leans toward poetic/metaphorical prose: "nuanced," "complexities"
- Diplomatic hedging even on documented facts

### Common across all models
- Uniform paragraph lengths
- Predictable section ordering (Background > Details > Impact > Response)
- Citation clustering at paragraph ends rather than distributed through sentences
- Excessive boldface on concepts and inline headers

## False Positive Prevention

### Exclusion zones
Do NOT flag text inside:
- Direct quotes from cited sources
- Titles, names, and other verbatim values from a source
- Code, configuration, or markup shown as examples

### Context-aware severity
If a banned word appears adjacent to specific named entities (proper nouns, statute numbers, dates, dollar amounts), it is more likely technical than filler. Reduce severity.
- **Higher severity:** "a comprehensive examination of the issues"
- **Lower severity:** "comprehensive audit by the FTC in 2024"

### Metaphorical vs literal
Only flag metaphorical uses:
- ecosystem: "Apple's software ecosystem" (OK) vs "the repair ecosystem" (flag)
- landscape: "Arizona landscape" (OK) vs "the regulatory landscape" (flag)
- navigate: "navigate the website" (OK) vs "navigate the regulatory process" (flag)
