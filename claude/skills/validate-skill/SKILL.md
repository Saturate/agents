---
name: validate-skill
description: Validates Claude Code skills against official best practices from Anthropic documentation. Fetches latest documentation dynamically to ensure current standards. Checks frontmatter, structure, line count, descriptions, references, workflows, and provides actionable recommendations. Use when asked to validate skill, check skill quality, review skill, or audit skill compliance.
compatibility: Requires Read, Grep, Glob, WebFetch tools for file analysis
allowed-tools: Read, Grep, Glob, Bash, WebFetch
metadata:
  author: Saturate
  version: "1.1"
---

You are validating a Claude Code skill against official best practices. Follow these steps:

## Progress Checklist

Copy this checklist to track validation progress:

```
Skill Validation Progress:
- [ ] Step 0: Fetched latest official documentation
- [ ] Step 1: Located and read SKILL.md file
- [ ] Step 2: Validated frontmatter (name, description, fields)
- [ ] Step 3: Checked file structure and organization
- [ ] Step 4: Analyzed content quality (line count, clarity, workflows)
- [ ] Step 5: Verified references and progressive disclosure
- [ ] Step 6: Checked for anti-patterns and common issues
- [ ] Step 7: Generated comprehensive report with score
```

## Step 0: Fetch Official Documentation

**IMPORTANT:** Always start by fetching the latest official documentation to ensure validation uses current standards.

**Fetch the primary documentation sources:**

1. **Skills Documentation:**
   - URL: `https://code.claude.com/docs/en/skills`
   - Prompt: "Extract all information about skill structure, SKILL.md format, frontmatter requirements, best practices, file organization, line count limits, progressive disclosure, and any specific guidelines for creating skills"

2. **Best Practices Guide:**
   - URL: `https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices`
   - Prompt: "Extract all best practices for creating agent skills, including structure, testing, writing guidelines, naming conventions, description format, common pitfalls to avoid, anti-patterns, and scoring criteria"

**Store the fetched information** for reference during validation steps.

**Fallback:** If WebFetch fails or documentation is unavailable, use the reference file [references/best-practices-checklist.md](references/best-practices-checklist.md) as a fallback, but note in the report that validation used cached/fallback documentation.

**Key criteria to extract from docs:**
- Maximum line counts (SKILL.md body, description, name)
- Required frontmatter fields and formats
- Naming conventions (gerund form recommended)
- Description writing style (third person, trigger keywords)
- Progressive disclosure patterns
- Reference depth limits (1 level)
- Anti-patterns to avoid
- Scoring rubrics

## Step 1: Locate and Read Skill

**Parse the skill path argument:**

Users invoke with: `/validate-skill path/to/skill` or `/validate-skill skill-name`

If no path provided, default to current directory.

**Locate the SKILL.md file:**

```bash
# If path is a directory, look for SKILL.md inside
if [ -d "$skill_path" ]; then
  skill_file="$skill_path/SKILL.md"
else
  skill_file="$skill_path"
fi

# Verify file exists
if [ ! -f "$skill_file" ]; then
  echo "Error: SKILL.md not found at: $skill_file"
  exit 1
fi
```

**Read the entire SKILL.md file** to analyze its content.

## Step 2: Validate Frontmatter

Check YAML frontmatter between `---` markers at the top of the file.

### Required Fields

**name:**
- ✅ Present and non-empty
- ✅ Maximum 64 characters
- ✅ Only lowercase letters, numbers, hyphens
- ✅ No XML tags
- ✅ No reserved words: "anthropic", "claude"
- ⚠️ Recommended: Use gerund form (-ing) like "processing-pdfs", "analyzing-data"

**description:**
- ✅ Present and non-empty
- ✅ Maximum 1024 characters
- ✅ No XML tags
- ✅ Third person (not "I" or "You")
- ✅ Includes WHAT the skill does
- ✅ Includes WHEN to use it (trigger keywords)
- ✅ Specific enough for discovery
- ⚠️ Should have 5+ trigger keywords/phrases

### Optional Fields

- `compatibility`: Helpful for users
- `allowed-tools`: List of tools skill can use
- `disable-model-invocation`: true/false
- `user-invocable`: true/false
- `metadata`: Author, version, etc.
- `context`: "fork" for subagent execution
- `agent`: Subagent type when context=fork

## Step 3: Check File Structure and Organization

**Main SKILL.md file:**
- ✅ Line count under 500 lines (critical threshold)
- ✅ Clear sections with headers
- ✅ Step-by-step workflow (if applicable)
- ⚠️ Consider splitting if approaching 500 lines

**Directory structure:**

```bash
skill-name/
├── SKILL.md              # Required
├── references/           # Optional but recommended for large skills
│   ├── guide.md         # Additional documentation
│   ├── examples.md      # Usage examples
│   └── api-ref.md       # API reference
└── scripts/             # Optional executable scripts
    └── helper.py
```

**Check for references directory:**
```bash
if [ -d "$skill_dir/references" ]; then
  # List reference files
  ls -1 "$skill_dir/references"
fi
```

**Check for scripts directory:**
```bash
if [ -d "$skill_dir/scripts" ]; then
  # List script files
  ls -1 "$skill_dir/scripts"
fi
```

## Step 4: Analyze Content Quality

### Line Count Analysis

Count lines in SKILL.md body (excluding frontmatter):

```bash
# Count total lines
total_lines=$(wc -l < "$skill_file")

# Count frontmatter lines (between first two ---)
frontmatter_lines=$(awk '/^---$/,/^---$/ {count++} END {print count}' "$skill_file")

# Body lines = total - frontmatter
body_lines=$((total_lines - frontmatter_lines))
```

**Scoring:**
- ✅ Excellent: Under 300 lines
- ✅ Good: 300-400 lines
- ⚠️ Acceptable: 400-500 lines
- ❌ Too long: Over 500 lines (should split into references)

### Content Clarity

**Check for clear workflows:**
- ✅ Numbered steps or clear sections
- ✅ Step-by-step instructions
- ✅ Progress checklist for complex workflows
- ✅ Clear conditional logic ("If X, do Y")

**Check for examples:**
- ✅ Code examples with syntax highlighting
- ✅ Input/output examples
- ✅ Common use case demonstrations

**Check for error handling:**
- ✅ Error scenarios documented
- ✅ Resolution steps provided
- ✅ Troubleshooting section or table

### Terminology Consistency

Scan for inconsistent terms:
- Check if same concept uses different words (e.g., "API endpoint" vs "URL" vs "route")
- Look for consistent naming patterns
- Verify technical terms are used correctly

### Anti-Patterns to Flag

Search for these problematic patterns:

**Time-sensitive information:**
```bash
grep -i "before [0-9]\{4\}" "$skill_file"  # "before 2025"
grep -i "after [0-9]\{4\}" "$skill_file"   # "after 2024"
grep -i "currently" "$skill_file"           # "currently available"
```

**Windows-style paths:**
```bash
grep -E "[a-zA-Z]:\\\\|scripts\\\\|reference\\\\" "$skill_file"
```

**First/second person in description:**
```bash
# Check description field for "I", "you", "we"
grep "^description:" "$skill_file" | grep -iE "\b(I|you|we|your|my)\b"
```

**Vague descriptions:**
```bash
# Check for overly generic terms
grep "^description:" "$skill_file" | grep -iE "\b(helps|processes|handles|manages|does)\b"
```

## Step 5: Verify References and Progressive Disclosure

### Reference Depth Check

**One-level deep references (GOOD):**
```markdown
SKILL.md references:
- [guide.md](references/guide.md)
- [examples.md](references/examples.md)
```

**Nested references (BAD):**
```markdown
SKILL.md → advanced.md → details.md → actual-content.md
```

**Validation steps:**
1. Find all markdown links in SKILL.md: `[text](path)`
2. For each linked file, check if it links to other files
3. Flag any references more than 1 level deep

### Progressive Disclosure Patterns

**Check if skill uses progressive disclosure properly:**

- ✅ SKILL.md provides overview and navigation
- ✅ References linked from SKILL.md for details
- ✅ Clear indication of what each reference contains
- ✅ Reference files have descriptive names

**Example of good pattern:**
```markdown
## Advanced features

**Form filling**: See [references/forms.md](references/forms.md) for complete guide
**API reference**: See [references/api.md](references/api.md) for all methods
```

### Table of Contents in Long References

For any reference file over 100 lines, check if it has a table of contents:

```bash
for ref_file in "$skill_dir/references"/*.md; do
  lines=$(wc -l < "$ref_file")
  if [ "$lines" -gt 100 ]; then
    # Check for TOC (look for "## Contents" or similar)
    if ! grep -qi "^## \(contents\|table of contents\)" "$ref_file"; then
      echo "⚠️ Warning: $ref_file is $lines lines but has no table of contents"
    fi
  fi
done
```

## Step 6: Check for Anti-Patterns and Issues

### Common Anti-Patterns

**Offering too many options:**
```bash
# Look for patterns like "you can use X, or Y, or Z"
grep -i "you can use.*or.*or" "$skill_file"
```

**Explaining obvious things:**
```bash
# Look for unnecessary explanations
grep -i "PDF.*portable document format" "$skill_file"
```

**Inconsistent formatting:**
- Mixed heading styles (# vs ##)
- Inconsistent code block languages
- Mixed bullet point styles (- vs *)

**Missing explicit instructions:**
- Check for vague language: "handle the file", "process the data"
- Look for clear action verbs: "Run", "Create", "Validate", "Check"

### Validation for Scripts

If `scripts/` directory exists:

**Check for documentation:**
- ✅ Each script mentioned in SKILL.md
- ✅ Clear description of what each script does
- ✅ Example usage commands
- ✅ Expected input/output formats

**Check for error handling:**
- ✅ Scripts handle missing files
- ✅ Scripts provide helpful error messages
- ✅ Scripts validate inputs

## Step 7: Generate Comprehensive Report

Create a structured report with the following sections:

### Report Structure

```markdown
# Skill Validation Report: {skill-name}

**Date:** {current-date}
**File:** {skill-path}
**Overall Score:** {score}/10
**Documentation:** Validated against latest official Anthropic documentation (fetched {timestamp})

---

## Summary

{1-2 paragraph overview of skill quality and main issues}

Note: This validation used the latest official Claude Code documentation from Anthropic to ensure current standards are applied.

---

## Scores by Category

| Category | Score | Status | Notes |
|----------|-------|--------|-------|
| Frontmatter | X/10 | ✅/⚠️/❌ | {issues} |
| Structure | X/10 | ✅/⚠️/❌ | {issues} |
| Content Quality | X/10 | ✅/⚠️/❌ | {issues} |
| Progressive Disclosure | X/10 | ✅/⚠️/❌ | {issues} |
| Anti-patterns | X/10 | ✅/⚠️/❌ | {issues} |

---

## ✅ Strengths

- {List what the skill does well}
- {Good patterns found}
- {Best practices followed}

---

## ❌ Critical Issues

{Issues that must be fixed}

1. **{Issue title}**
   - **Severity:** Critical
   - **Current:** {what's wrong}
   - **Fix:** {how to fix it}
   - **Why:** {why it matters}

---

## ⚠️ Warnings

{Issues that should be fixed}

1. **{Issue title}**
   - **Severity:** Important
   - **Current:** {what's wrong}
   - **Fix:** {how to fix it}
   - **Why:** {why it matters}

---

## 💡 Recommendations

{Optional improvements}

1. **{Recommendation title}**
   - **Impact:** Minor/Medium/High
   - **Suggestion:** {what to do}
   - **Benefit:** {why it helps}

---

## 📊 Detailed Metrics

| Metric | Value | Threshold | Status |
|--------|-------|-----------|--------|
| SKILL.md line count | {lines} | < 500 | ✅/⚠️/❌ |
| Description length | {chars} | < 1024 | ✅/⚠️/❌ |
| Name length | {chars} | < 64 | ✅/⚠️/❌ |
| Trigger keywords | {count} | 5+ | ✅/⚠️/❌ |
| Reference depth | {depth} | 1 level | ✅/⚠️/❌ |
| Reference files | {count} | - | ℹ️ |
| Script files | {count} | - | ℹ️ |

---

## 📋 Best Practices Checklist

Copy this checklist to track improvements:

```
Skill Quality Checklist:
- [ ] Description is specific with 5+ trigger keywords
- [ ] Description uses third person (no "I" or "you")
- [ ] Name uses gerund form (-ing) or is clearly descriptive
- [ ] SKILL.md body under 500 lines
- [ ] References are one level deep from SKILL.md
- [ ] Long reference files (>100 lines) have table of contents
- [ ] Clear workflows with numbered steps
- [ ] Progress checklist for complex workflows
- [ ] Consistent terminology throughout
- [ ] No time-sensitive information
- [ ] No Windows-style paths (all forward slashes)
- [ ] Error handling documented
- [ ] Examples provided for key patterns
- [ ] Scripts documented with usage examples
```

---

## 🔗 References

- [Official Skill Documentation](https://code.claude.com/docs/en/skills)
- [Best Practices Guide](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices)
- [Agent Skills Standard](https://agentskills.io)
```

### Scoring Guidelines

**Overall Score Calculation:**

- **10/10**: Perfect - Follows all best practices
- **9/10**: Excellent - Minor improvements possible
- **8/10**: Very Good - Few minor issues
- **7/10**: Good - Some improvements needed
- **6/10**: Acceptable - Several issues to address
- **5/10**: Needs Work - Multiple problems
- **4/10 or below**: Significant Issues - Major refactoring needed

**Category Scoring:**

Each category scored 0-10 based on:
- **10**: Perfect compliance
- **8-9**: Good with minor issues
- **6-7**: Acceptable with improvements needed
- **4-5**: Multiple issues found
- **0-3**: Critical problems

## Tips for Great Reports

1. **Use latest standards**: Validate against the freshly fetched official documentation, not outdated cached information
2. **Be specific**: Reference exact line numbers, file names, and code snippets
3. **Prioritize**: List critical issues before minor suggestions
4. **Explain why**: Don't just say what's wrong, explain why it matters (reference the official docs)
5. **Provide examples**: Show good vs bad examples for each issue
6. **Be constructive**: Focus on improvement, not just criticism
7. **Reference docs**: Link to official best practices for each recommendation
8. **Note documentation timestamp**: Include when the docs were fetched so users know validation is current

## Example Validation Session

**User:** `/validate-skill skills/make-pr`

**You should:**
1. **Fetch latest documentation** from official Anthropic sources (Step 0)
2. Read `skills/make-pr/SKILL.md` (Step 1)
3. Validate against fetched documentation criteria (Steps 2-6)
4. Generate comprehensive report (Step 7)
5. Provide actionable recommendations with specific line numbers
6. Give overall score with justification
7. Include timestamp of documentation fetch in report

---

## Reference Materials

**Primary source:** Always fetch latest documentation from:
- https://code.claude.com/docs/en/skills
- https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices

**Fallback reference:** If WebFetch is unavailable, see [references/best-practices-checklist.md](references/best-practices-checklist.md) for cached best practices (note: may be outdated).
