---
name: knowledge
description: Stores learnings in and recalls knowledge from the Obsidian vault. Use `/knowledge store` after a session where something worth keeping was learned, or `/knowledge recall <topic>` to check for existing notes before starting work. Triggers on save knowledge, remember this, what do I know about, check notes, recall, look up prior knowledge.
allowed-tools: Read Edit Write Bash Grep Glob
user-invocable: true
metadata:
  author: alkj
  version: "1.0"
---

# Knowledge

Two modes: **store** (save learnings) and **recall** (search existing knowledge).

## Mode Detection

- `store` (or no args after a session): synthesize and save
- `recall <topic>`: search and load

If the user just types `/knowledge`, ask which mode.

## Vault

```
VAULT=!`python3 scripts/find-vault.py`
```

If the vault path is empty, tell the user the Knowledge vault was not found in Obsidian's config and stop.

Read `$VAULT/Knowledge.md` for conventions before writing. All writing rules (atomic notes, wikilinks, frontmatter format, naming) are defined there; follow them, don't duplicate them here.

## Recall Mode

Search the vault for existing knowledge on a topic.

### Steps

1. Try [Obsidian CLI](https://obsidian.md/cli) first (requires Obsidian desktop running):
   ```bash
   obsidian search query="<topic>" vault="Knowledge" 2>/dev/null
   ```
2. If CLI fails or returns nothing, fall back to filesystem search:
   ```bash
   rg -li "<topic>" "$VAULT" --glob="*.md"
   ```
3. Read matching files (max 5)
4. Summarize what the vault contains on this topic
5. If nothing found, say so clearly

### Output

Brief summary of what's in the vault, with pointers to specific files. Don't dump entire files; synthesize.

## Store Mode

Save knowledge from the current conversation to the vault.

### Steps

```
Store Progress:
- [ ] Read Knowledge.md conventions
- [ ] Identified what to save
- [ ] Checked for existing pages
- [ ] Created or updated file
- [ ] Updated category index
- [ ] Confirmed to user
```

1. Read `$VAULT/Knowledge.md` for current conventions and categories
2. Ask the user: **"What did we learn that's worth keeping?"** (unless they already said)
3. Check if a relevant page already exists:
   ```bash
   rg -li "<concept>" "$VAULT" --glob="*.md"
   ```
4. If page exists: **update it** (don't create a duplicate)
5. If new: create a file in the appropriate category folder, update `index.md` if one exists

### After Writing

- Confirm to the user what was saved and where
- Mention any existing pages that were updated vs created new
- Suggest wikilinks to add to other pages if relevant
