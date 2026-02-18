# Skill Validation Report Template

Reference for: Skill Validation

Use this template to structure validation reports with consistent formatting.

## Report Structure

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
- Long reference files (>100 lines) have table of contents
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

## Scoring Guidelines

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
