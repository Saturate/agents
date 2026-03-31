# Claude Code Skills Best Practices Checklist

> **Note:** This is a **fallback reference** used only when live documentation cannot be fetched. The `/validate-skill` skill automatically fetches the latest official documentation from Anthropic to ensure validation uses current standards. This file is maintained as a backup and may become outdated as best practices evolve.

Comprehensive checklist extracted from official Anthropic documentation for validating skills.

## Source Documentation

**Latest (Always Fetch These):**
- [Official Skills Documentation](https://code.claude.com/docs/en/skills)
- [Best Practices Guide](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices)
- [Agent Skills Standard](https://agentskills.io)

**This file last updated:** 2026-01-29

---

## Table of Contents

1. [Source Documentation](#source-documentation)
2. [Core Principles](#core-principles)
3. [Frontmatter Requirements](#frontmatter-requirements)
4. [File Structure](#file-structure)
5. [Progressive Disclosure](#progressive-disclosure)
6. [Content Quality](#content-quality)
7. [Anti-Patterns to Avoid](#anti-patterns-to-avoid)
8. [Scripts and Executable Code](#scripts-and-executable-code)
9. [String Substitutions](#string-substitutions)
10. [MCP Tools](#mcp-tools)
11. [Testing and Iteration](#testing-and-iteration)
12. [Advanced: Visual Output](#advanced-visual-output)
13. [Platform-Specific Notes](#platform-specific-notes)
14. [Final Checklist](#final-checklist)
15. [Scoring Rubric](#scoring-rubric)
16. [Common Issues and Fixes](#common-issues-and-fixes)
17. [Resources](#resources)

---

## Core Principles

### Conciseness
- [ ] Only includes context Claude doesn't already have
- [ ] Avoids explaining obvious concepts
- [ ] Challenges each piece of information for necessity
- [ ] Keeps SKILL.md body under 500 lines
- [ ] Uses progressive disclosure for detailed content

### Appropriate Degrees of Freedom

**High freedom (text instructions):**
- Multiple approaches are valid
- Decisions depend on context
- Heuristics guide the approach

**Medium freedom (pseudocode/scripts with parameters):**
- Preferred pattern exists
- Some variation is acceptable
- Configuration affects behavior

**Low freedom (specific scripts, few parameters):**
- Operations are fragile and error-prone
- Consistency is critical
- Specific sequence must be followed

### Testing
- [ ] Tested with all target models (Haiku, Sonnet, Opus)
- [ ] At least 3 evaluations created
- [ ] Tested with real usage scenarios
- [ ] Team feedback incorporated (if applicable)

---

## Frontmatter Requirements

### Required: name
- [ ] Maximum 64 characters
- [ ] Only lowercase letters, numbers, and hyphens
- [ ] No XML tags
- [ ] No reserved words: "anthropic", "claude"
- [ ] Recommended: Use gerund form (-ing)
  - Good: `processing-pdfs`, `analyzing-data`, `creating-reports`
  - Acceptable: `pdf-processing`, `data-analysis`, `report-creation`
  - Avoid: `helper`, `utils`, `tools`, `documents`

### Required: description
- [ ] Non-empty
- [ ] Maximum 1024 characters
- [ ] No XML tags
- [ ] **Always third person** (not "I" or "you")
  - Good: "Processes Excel files and generates reports"
  - Bad: "I can help you process Excel files"
  - Bad: "You can use this to process Excel files"
- [ ] Includes WHAT the skill does
- [ ] Includes WHEN to use it (trigger keywords)
- [ ] Specific enough for Claude to discover (5+ keywords recommended)
- [ ] Includes key differentiators or unique features

**Good description examples:**

```yaml
# PDF Processing
description: Extract text and tables from PDF files, fill forms, merge documents. Use when working with PDF files or when the user mentions PDFs, forms, or document extraction.

# Excel Analysis
description: Analyze Excel spreadsheets, create pivot tables, generate charts. Use when analyzing Excel files, spreadsheets, tabular data, or .xlsx files.

# Git Commit Helper
description: Generate descriptive commit messages by analyzing git diffs. Use when the user asks for help writing commit messages or reviewing staged changes.
```

**Bad description examples:**

```yaml
description: Helps with documents  # Too vague
description: Processes data  # Too generic
description: Does stuff with files  # Meaningless
```

### Optional Fields
- [ ] `compatibility`: Helpful for users to know requirements
- [ ] `allowed-tools`: List of tools skill can use without permission
- [ ] `disable-model-invocation`: true/false (prevent auto-invocation)
- [ ] `user-invocable`: true/false (hide from / menu)
- [ ] `metadata`: Author, version, etc.
- [ ] `context`: "fork" for subagent execution
- [ ] `agent`: Subagent type when context=fork
- [ ] `hooks`: Skill-scoped hooks

---

## File Structure

### Main SKILL.md
- [ ] YAML frontmatter between `---` markers at top
- [ ] Body under 500 lines (300-400 is excellent)
- [ ] Clear sections with markdown headers
- [ ] Step-by-step workflow (if applicable)
- [ ] References to additional files (if needed)

### Directory Organization

```
skill-name/
├── SKILL.md              # Required - main instructions
├── references/           # Optional - detailed docs
│   ├── guide.md         # How-to guides
│   ├── examples.md      # Usage examples
│   └── api-ref.md       # API reference
└── scripts/             # Optional - executable scripts
    ├── helper.py        # Utility scripts
    └── validate.sh      # Validation scripts
```

- [ ] Skill directory named clearly (matches skill name)
- [ ] SKILL.md exists and is readable
- [ ] Reference files in `references/` subdirectory (if used)
- [ ] Scripts in `scripts/` subdirectory (if used)
- [ ] All paths use forward slashes (Unix-style)

---

## Progressive Disclosure

### References
- [ ] References are one level deep from SKILL.md
- [ ] No deeply nested references (SKILL.md → ref1.md → ref2.md ❌)
- [ ] Reference files have descriptive names
- [ ] SKILL.md clearly indicates what each reference contains
- [ ] Long reference files (>100 lines) have table of contents

**Good pattern:**
```markdown
# SKILL.md

## Advanced features

**Form filling**: See [references/forms.md](references/forms.md) for complete guide
**API reference**: See [references/api.md](references/api.md) for all methods
**Examples**: See [references/examples.md](references/examples.md) for common patterns
```

**Bad pattern:**
```markdown
# SKILL.md
See [advanced.md](advanced.md) for more info

# advanced.md
See [details.md](details.md) for details

# details.md
Here's the actual information...
```

### Domain-Specific Organization

For skills with multiple domains:

```
skill/
├── SKILL.md (overview and navigation)
└── reference/
    ├── domain1.md (focused content)
    ├── domain2.md (focused content)
    └── domain3.md (focused content)
```

- [ ] Each domain in separate file
- [ ] SKILL.md provides clear navigation
- [ ] Users can grep for specific topics
- [ ] No loading irrelevant domain content

---

## Content Quality

### Clarity and Structure
- [ ] Clear numbered steps or sections
- [ ] Progress checklist for complex workflows
- [ ] Conditional logic clearly marked ("If X, then Y")
- [ ] Examples provided for key patterns
- [ ] Input/output examples where applicable
- [ ] Error handling documented

### Workflows
- [ ] Complex workflows broken into clear steps
- [ ] Copyable checklist for tracking progress
- [ ] Each step has clear purpose
- [ ] Validation/verification steps included
- [ ] Feedback loops for quality-critical tasks

**Good workflow example:**
````markdown
## Workflow

Copy this checklist:

```
Task Progress:
- [ ] Step 1: Analyze input
- [ ] Step 2: Validate data
- [ ] Step 3: Process
- [ ] Step 4: Verify output
```

**Step 1: Analyze input**
[Clear instructions]

**Step 2: Validate data**
Run: `python scripts/validate.py`
If errors, return to Step 1.

[etc.]
````

### Examples
- [ ] Concrete examples, not abstract
- [ ] Input/output pairs shown
- [ ] Code examples use syntax highlighting
- [ ] Common use cases demonstrated
- [ ] Edge cases illustrated

### Error Handling
- [ ] Error scenarios documented
- [ ] Resolution steps provided
- [ ] Troubleshooting section or table
- [ ] Common pitfalls explained

### Terminology
- [ ] Consistent terms throughout
- [ ] One term per concept (not "API endpoint" / "URL" / "route" mixed)
- [ ] Technical terms used correctly
- [ ] No jargon without explanation

---

## Anti-Patterns to Avoid

### Time-Sensitive Information
- [ ] ❌ No "before 2025" or "after 2024" dates
- [ ] ❌ No "currently available" statements
- [ ] ✅ Use "old patterns" section for deprecated content

**Bad:**
```markdown
If you're doing this before August 2025, use the old API.
```

**Good:**
```markdown
## Current method
Use the v2 API endpoint: `api.example.com/v2/messages`

<details>
<summary>Legacy v1 API (deprecated 2025-08)</summary>

The v1 API used: `api.example.com/v1/messages`
This endpoint is no longer supported.
</details>
```

### Windows-Style Paths
- [ ] ❌ No backslashes: `scripts\helper.py`
- [ ] ✅ Use forward slashes: `scripts/helper.py`
- [ ] Works across all platforms

### Offering Too Many Options
- [ ] ❌ Don't list 5+ alternative approaches
- [ ] ✅ Provide default with escape hatch

**Bad:**
```markdown
You can use pypdf, or pdfplumber, or PyMuPDF, or pdf2image, or...
```

**Good:**
```markdown
Use pdfplumber for text extraction:
[code example]

For scanned PDFs requiring OCR, use pdf2image with pytesseract instead.
```

### Explaining Obvious Things
- [ ] ❌ Don't explain what Claude already knows
- [ ] ✅ Assume Claude is smart, provide only new context

**Bad:**
```markdown
PDF (Portable Document Format) files are a common file format that contains
text, images, and other content. To extract text from a PDF, you'll need to
use a library...
```

**Good:**
```markdown
Use pdfplumber for text extraction:
[code example]
```

### Vague Language
- [ ] ❌ Avoid: "handle", "process", "manage" without specifics
- [ ] ✅ Use clear action verbs: "Run", "Create", "Validate", "Check"

### First/Second Person in Description
- [ ] ❌ No "I can help you..."
- [ ] ❌ No "You can use this..."
- [ ] ✅ Always third person: "Processes files and..."

---

## Scripts and Executable Code

### Utility Scripts
- [ ] Each script mentioned in SKILL.md
- [ ] Clear description of what each does
- [ ] Example usage commands provided
- [ ] Expected input/output formats documented
- [ ] Scripts handle errors explicitly (don't punt to Claude)

### Script Documentation
````markdown
**analyze_form.py**: Extract form fields from PDF

```bash
python scripts/analyze_form.py input.pdf > fields.json
```

Output format:
```json
{
  "field_name": {"type": "text", "x": 100, "y": 200}
}
```
````

### Error Handling in Scripts
- [ ] Scripts validate inputs
- [ ] Clear error messages provided
- [ ] Fallback behavior defined
- [ ] No "voodoo constants" (all values justified)

**Good:**
```python
# HTTP requests typically complete within 30 seconds
REQUEST_TIMEOUT = 30

# Three retries balances reliability vs speed
MAX_RETRIES = 3
```

**Bad:**
```python
TIMEOUT = 47  # Why 47?
RETRIES = 5   # Why 5?
```

### Verifiable Intermediate Outputs
- [ ] Complex workflows use plan-validate-execute pattern
- [ ] Validation scripts check plans before execution
- [ ] Clear error messages point to specific problems
- [ ] Batch operations validated upfront

---

## String Substitutions

### Available Variables
- [ ] `$ARGUMENTS` - All arguments passed to skill
- [ ] `$ARGUMENTS[N]` or `$N` - Specific argument by index
- [ ] `${CLAUDE_SESSION_ID}` - Current session ID

### Dynamic Context Injection
- [ ] `!`command`` syntax for shell command output
- [ ] Commands run before Claude sees content
- [ ] Output replaces placeholder in skill content

**Example:**
````markdown
## Pull request context
- PR diff: !`gh pr diff`
- PR comments: !`gh pr view --comments`
````

---

## MCP Tools

### Tool References
- [ ] Always use fully qualified names: `ServerName:tool_name`
- [ ] Example: `BigQuery:bigquery_schema`, not just `bigquery_schema`
- [ ] Prevents "tool not found" errors

---

## Testing and Iteration

### Evaluation-Driven Development
1. [ ] Identify gaps by running Claude without skill
2. [ ] Create 3+ evaluation scenarios
3. [ ] Establish baseline performance
4. [ ] Write minimal instructions to address gaps
5. [ ] Execute evaluations and iterate

### Iterative Development with Claude
1. [ ] Complete task with Claude A (helper)
2. [ ] Identify reusable patterns
3. [ ] Ask Claude A to create skill
4. [ ] Review for conciseness
5. [ ] Improve information architecture
6. [ ] Test with Claude B (uses the skill)
7. [ ] Iterate based on Claude B's behavior

### Observation Points
- [ ] Does Claude read files in expected order?
- [ ] Does Claude follow references to important files?
- [ ] Does Claude repeatedly read same file (should be in main SKILL.md)?
- [ ] Does Claude never access certain files (remove or improve signaling)?

---

## Advanced: Visual Output

### Generating Visual Output
- [ ] Bundle scripts that generate HTML/visualizations
- [ ] Open in browser after generation
- [ ] Self-contained output (no external dependencies)
- [ ] Clear instructions for running generation scripts

---

## Platform-Specific Notes

### claude.ai
- [ ] Can install packages from npm and PyPI
- [ ] Can pull from GitHub repositories
- [ ] Has network access

### Anthropic API
- [ ] No network access
- [ ] No runtime package installation
- [ ] List required packages in SKILL.md
- [ ] Verify packages available in code execution tool docs

---

## Final Checklist

### Before Sharing a Skill

**Core quality:**
- [ ] Description specific with 5+ trigger keywords
- [ ] Description includes what AND when
- [ ] SKILL.md body under 500 lines
- [ ] Additional details in separate files
- [ ] No time-sensitive information
- [ ] Consistent terminology
- [ ] Concrete examples
- [ ] One-level deep references
- [ ] Progressive disclosure used
- [ ] Clear workflows

**Code and scripts:**
- [ ] Scripts solve problems (don't punt to Claude)
- [ ] Explicit error handling
- [ ] No voodoo constants
- [ ] Required packages listed and verified
- [ ] Scripts documented
- [ ] No Windows paths
- [ ] Validation for critical operations
- [ ] Feedback loops included

**Testing:**
- [ ] 3+ evaluations created
- [ ] Tested with Haiku, Sonnet, Opus
- [ ] Tested with real scenarios
- [ ] Team feedback incorporated

---

## Scoring Rubric

### Overall Score Guidelines
- **10/10**: Perfect - Follows all best practices
- **9/10**: Excellent - Minor improvements possible
- **8/10**: Very Good - Few minor issues
- **7/10**: Good - Some improvements needed
- **6/10**: Acceptable - Several issues to address
- **5/10**: Needs Work - Multiple problems
- **4/10 or below**: Significant Issues - Major refactoring needed

### Category Breakdown
- **Frontmatter** (20%): Name, description, fields
- **Structure** (20%): Line count, organization, references
- **Content Quality** (25%): Clarity, workflows, examples
- **Progressive Disclosure** (15%): References, TOCs, navigation
- **Anti-patterns** (20%): Time-sensitivity, paths, consistency

---

## Common Issues and Fixes

### Issue: Description Too Vague
**Current:** "Helps with documents"
**Fix:** "Extracts text from PDF files, fills forms, and merges documents. Use when working with PDFs, forms, or document extraction."

### Issue: SKILL.md Too Long
**Current:** 800 lines in SKILL.md
**Fix:** Split into SKILL.md (overview) + references/guide.md (details) + references/examples.md (examples)

### Issue: Nested References
**Current:** SKILL.md → advanced.md → details.md
**Fix:** SKILL.md → references/advanced.md, SKILL.md → references/details.md

### Issue: Windows Paths
**Current:** `scripts\validate.py`
**Fix:** `scripts/validate.py`

### Issue: Time-Sensitive
**Current:** "If you're doing this before August 2025..."
**Fix:** Use "old patterns" section with deprecation notes

### Issue: First Person Description
**Current:** "I can help you process files"
**Fix:** "Processes files and generates reports. Use when..."

### Issue: Too Many Options
**Current:** "You can use X, or Y, or Z, or A, or B..."
**Fix:** "Use X for most cases. For special case Y, use Z instead."

---

## Resources

- [Official Skills Documentation](https://code.claude.com/docs/en/skills)
- [Best Practices Guide](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices)
- [Agent Skills Standard](https://agentskills.io)
- [Code Execution Tool Docs](https://platform.claude.com/docs/en/agents-and-tools/tool-use/code-execution-tool)
