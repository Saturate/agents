# skill-router

Makes Claude use the right skill for high-signal commands, and asks you before anything external or destructive runs.

It has two parts:

- **At session start** a settings hook injects the [skill-router meta-skill](../../skills/skill-router/SKILL.md), the map of which skill fits which task.
- **On every tool call** a mod (`hooks/register.ts`) checks the call against [`scripts/advisor-rules.conf`](scripts/advisor-rules.conf).

![Hook flow](diagrams/hook-flow.png)

The diagram is generated from the rules file; its source is [`diagrams/hook-flow.mmd`](diagrams/hook-flow.mmd).

## What the rules do

- **block:** the command is refused until the named skill has loaded in this conversation, through the Skill tool or `/name`. `git commit` needs `commit`, `gh pr create` needs `make-pr`, `npm install <pkg>` needs `evaluating-dependencies`, `rm -r` needs `safe-delete`, and so on. A subagent has to load the skill itself, and a compaction or `/clear` means loading it again.
- **gate:** the call is printed in the transcript, then a dialog asks **Run it**, **Allow for this session**, **Always allow in this project** or **Don't run**. A `gh pr comment`, `gh pr review`, `gh issue create`, `az repos pr set-vote`/`update` or `az devops invoke` is laid out as fields (PR, title, labels) with the text that gets posted below them, heredocs and `--body-file` contents included; an MCP call shows its arguments the same way. A command it can't read exactly is shown as written. Text you type under "Other" goes back to Claude as your instruction. "Allow for this session" lasts until the session ends and is offered wherever "always allow" is. "Always allow" covers that one rule for the repo the command runs in, keyed by its git remote (ssh and https clones and worktrees share it); an Azure DevOps MCP call is keyed by the project and repository it names instead. An `az repos pr set-vote` or `update` names its PR by id, so it gets them only when `az repos pr show` run from the same directory places that PR in the repo of its one remote, and never with `--org`, `--detect`, `--subscription` or a policy bypass. It isn't offered for force pushes, `git reset --hard`, forks, `az devops invoke` or `az rest`, or for a PR that already carries a policy bypass; for a call that runs anything besides the gated commands (a `cd`, however it is spelled); for a command that names another repo (`-R`, `--repo`, `--org`, `--project`, `--repository`, a URL, `GH_REPO=` and similar); in a repo with more than one remote or a `gh repo set-default`, where gh might not post to that remote; or for an MCP call that bypasses branch policy. `/gates` lists what is allowed and `/gates reset` undoes all of it, session allows included. This covers creating issues, PR reviews and comments, force pushes, `git reset --hard`, forks, Azure DevOps PR votes and updates, REST calls through `az devops invoke` or `az rest`, and any `az` command whose command words come from an `@file`, and PR writes or comments through the Azure DevOps MCP server. With nobody to answer (`claude -p`), the command is refused. The dialog also works over Remote Control.

Each simple command in a Bash call is matched on its own: the call is split on `&&`, `||`, `;`, `|` and newlines, quoted text and heredoc bodies are ignored, and the body of a `$(...)` is matched as its own command. So a commit message that mentions `git push` is not a push, and `cd app && git push` still is.

## Editing the rules

Rules are tab-separated lines in `scripts/advisor-rules.conf`; the header in that file describes the format. The first matching rule wins for each command, so put specific rules before general ones. Patterns use `grep -E` syntax.

After an edit:

```bash
node plugins/skill-router/scripts/test-rules.ts        # rule cases against the real file
claude plugin test plugins/skill-router                # the mod's own tests
bash plugins/skill-router/scripts/generate-diagrams.sh --render
```

## Requirements

Claude Code 2.1.287 or later, since the checks run as a mod. On older versions only the session-start map loads.
