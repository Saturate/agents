# secret-mask

A Claude Code mod that keeps secrets out of what the model reads, while still letting Claude use them.

Secrets are swapped for placeholders like `{{SECRET_1:github-token}}` in your prompts and in every tool result before the model reads them. When Claude puts a placeholder in a field a tool acts on (a Bash command, an Edit or Write, a WebFetch URL, MCP tool arguments), the mod asks you first, then puts the real value in right before the tool runs. Text that goes to a model (Agent and SendMessage prompts, a Skill's arguments, WebFetch's `prompt`) never gets the real value. The output is masked again on the way back.

## Use

- **Hand over a secret on purpose:** run `/mask <value>`, or `/mask` alone to paste it into a field. The placeholder is inserted at your cursor and the value never passes through the prompt. Inline, `<secret>value</secret>` does the same. Either way Claude can use it without asking, since you gave it. MCP tools still ask, because some MCP servers are model-backed.
- **Detected secrets:** known token formats (GitHub, GitLab, AWS, Anthropic, OpenAI, Slack, Stripe, Google, JWTs, private keys, Azure account keys, connection-string and URL passwords) and `UPPER_CASE_SECRET=value` lines are masked automatically. Using one asks first: allow once, allow for this session, or deny.
- **`.env` files:** values in `.env*` files (not `.env.example` and friends) up to three folders below the project root are masked from session start, and again whenever Claude reads one. A value is masked when its key is clearly secret (`*_TOKEN`, `*_PASSWORD`, `*_SECRET`, `DSN`, ...), when its key is loosely secret (`*_KEY`, `AUTH_*`, `*_COOKIE`) and the value is long and not a path or host name, or when the value looks random. Booleans, numbers, short plain words, paths and host names are skipped, so `PORT=3000`, `DB_CONNECTION=sqlite`, `SESSION_ENCRYPT=false` and `DB_HOST=db.example.internal` stay readable.
- **Encoded copies:** base64, base64url, hex, reversed and URL-encoded forms of a known value are masked in output too, as markers with a `:kind` suffix that never unmask.
- **Slash commands:** `<secret>` and detected tokens are masked in command arguments too. This also applies to local commands like `/plugin`, which then receive the placeholder rather than the value.
- **Claude knows:** a short note added to the Bash tool's description (the built-in guard keeps user mods out of the system prompt) tells Claude to use placeholders as they are, never to decode them, and to suggest `/mask` when you need to hand over a secret.
- **`/secrets`** lists the placeholders in this session. It never shows values.

An `Edit` that leaves every line holding a placeholder exactly as it was does not ask, so editing a config file next to a secret stays quiet. Changing or adding a line that holds one asks.

## Limits

- A placeholder with a label only unmasks when the label matches the secret's. A bare `{{SECRET_n}}` unmasks by number, so code or docs that contain one literally get the real value written in when Claude writes them through a tool.

- Masking covers prompts, command arguments, tool results, and deny or error text from layers below. Claude Code's built-in `cc-plugin-sec-default` guard keeps user-installed mods off `session.append`, so attachments and the system prompt are not rewritten. Context a hook attaches to a tool result can't be rewritten either, so a result whose context holds a secret is withheld and the model gets the masked output as the reason instead.
- An @-mentioned file that holds a secret is refused, with a note to open it through the Read tool instead, which is masked.
- Values printed in pieces, hashed, or run through a custom script are not caught by the encoding pass. The approval prompt is the real guard, and your own `/mask` and `<secret>` values skip it.
- Neither form hides the value on your screen: the `/mask` field has no password mode, and `/mask <value>` sits in the prompt box until you press Enter.
- A `<secret>` shorter than 4 characters is replaced where you tagged it but not masked in output, since masking it everywhere would eat ordinary text.
- An approved unmask runs whatever the command does with the value. Review the command in the prompt before allowing it (a long command is shown as its start, the text around each placeholder, and its end); "allow for this session" skips that review for that secret.
- Settings hooks that log tool input (PreToolUse) see the unmasked call.
- The vault lives in the session's `$.state`, so it survives a hot reload of the mod. The mod never writes it to `$.store` or to files.
- A secret-named `.env` value that is a short plain lowercase word (under 12 letters) is not masked, to keep config words like `database` readable everywhere.
- A hidden message that starts a turn on its own (a peer session's or channel's message arriving while idle) can't be rewritten, so one that holds a secret is dropped and you get a toast. Background task notifications arrive as normal prompts and are masked.
- In `claude -p` nobody can answer the prompt, so detected secrets are denied there.

## Install

```
/plugin install secret-mask@Saturate-agents
```

Requires Claude Code 2.1.287 or later.
