# Sources

Research and references used to compile the anti-slop rules. Fetch these for deeper analysis or to check for updated patterns.

## Primary rule sources

- [realrossmanngroup/no_ai_slop_writing_rules](https://github.com/realrossmanngroup/no_ai_slop_writing_rules) - 24 anti-slop rules with worked examples and a data-driven banned word reference. The foundation for most of the hard bans.
- [The Field Guide to AI Slop](https://www.ignorance.ai/p/the-field-guide-to-ai-slop) (Charlie Guo) - Structural and vocabulary detection signals. Source for inflated symbolism frequency multipliers.
- [The AI Ick](https://stackoverflow.blog/2025/11/05/the-ai-ick) (Stack Overflow Blog) - Tone and voice signals, "all product no struggle" pattern.
- [AI Slop, Suspicion, and Writing Back](https://benjamincongdon.me/blog/2025/01/25/AI-Slop-Suspicion-and-Writing-Back/) (Ben Congdon) - "Median human data annotator" framing. Distinctive voice as primary defense.
- [Wikipedia: Signs of AI Writing](https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing) - Comprehensive banned word lists, academic tells, hallucinated markup artifacts, hedging thresholds, structural/statistical patterns.
- [Most Common ChatGPT Words to Avoid](https://walterwrites.ai/most-common-chatgpt-words-to-avoid/) (Walter Writes AI) - Vocabulary-level tells.
- [The Augmented Educator: Ten Telltale Signs](https://www.theaugmentededucator.com/p/the-ten-telltale-signs-of-ai-generated) - Educational context detection signals.

## Research and corpus studies

- isgpt.org corpus analysis (2025) - Source for inflated symbolism frequency multipliers (468x, 317x, etc.)
- ACL hedging study (2024, 12,000 technical documents) - AI models hedge 4-7x more than human writers
- Segmental entropy research (arxiv, 2025) - AI maintains flat stylistic consistency; humans vary pacing across sections

## Community feedback

- r/programming discussion on [Why AI exposes weak engineering practices](https://akj.io/ai-coding-security-infrastructure) - Specific patterns flagged: "It's not X, it's Y" constructions, staccato short sentences, lack of personal anecdotes, presenting obvious observations as insights.
