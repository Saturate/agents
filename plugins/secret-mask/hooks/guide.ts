// Without this Claude only learns about the mod by running into a
// placeholder, and may ask the user to paste a token, "fix" a placeholder,
// or try to decode one. Static text, so it rides in the prompt cache.
export const GUIDE = [
  'Secrets in this session are replaced with placeholders like ' + '`{{SECRET_<n>:<label>}}`' + ' by the secret-mask plugin.',
  'Use a placeholder as-is in Bash commands, file edits, URLs and MCP tool arguments: the real value is filled in when the tool runs, after the user approves. Text you send to a subagent or another model never gets the real value.',
  'Never try to reveal, decode, encode, split or otherwise transform a placeholder value, and do not ask the user to paste a secret.',
  'A marker with a third part, like ' + '`{{SECRET_<n>:<label>:base64}}`' + ', is a masked copy of an encoded value and cannot be used.',
  'If the user needs to hand over a secret, suggest `/mask <value>`; `/secrets` lists the placeholders in use.',
].join(' ')
