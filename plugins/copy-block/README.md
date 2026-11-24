# copy-block

Hover one of Claude's messages in the transcript (the text between two tool calls) and copy buttons appear at its top-right corner:

- **copy all** copies the whole message as markdown.
- **copy code** copies one fenced code block (numbered when the reply has several).
- **copy quote** copies one `>` quote, without the `>` markers, so it pastes as plain paragraphs.
- **run** appears for a `! command` line (inline code with a space after `!`, or a one-line code block). It fills an empty prompt box with the command; press Enter on it unedited and the mod runs it with your login shell, in the session's starting directory, and hands the exit code and output to Claude with your message. A mod cannot switch the box into shell mode, so this stands in for typing `!` yourself. Anything else you send first disarms it, an edited command is sent as plain text, and Esc stops a running one. The command gets no terminal or input, so use it for non-interactive commands; `sudo` or `ssh` prompts fail.

A toast says what was copied and how many lines. A code block with no closing fence gets no button, since that is almost always a message still streaming; **copy all** on a streaming message copies what has arrived so far. A code block inside a quote is copied as part of the quote, fences included. Code under a list nested three or more levels deep may get no button.

Needs the fullscreen renderer (`/tui fullscreen`): the classic renderer does not report the mouse, so the buttons never appear there.
