import { expect, test } from 'claude-code/testing'

import { Vault, isEnvFilePath } from './vault'

const ph = (rest: string): string => '{' + '{SECRET_' + rest + '}' + '}'
const bash = (stdout: string) => ({ result: { stdout, stderr: '', interrupted: false } })
const RANDOM = ['Zx9', 'qP2', 'mW7', 'vT4', 'kR8', 'nB3', 'Lf6', 'Hd1'].join('')

test('reading a .env file masks secret-looking values and keeps plain config', async ($, on) => {
  on('tool.call', () => bash(`PORT=3000\nDB_HOST=localhost\nDB_PASSWORD="hunter2-long"\nSOME_ID=${RANDOM}\n`))

  const out = JSON.stringify(await $.tool.call({ tool: 'Bash', command: 'cat config/.env.local' }))

  expect(out).toContain('PORT=3000')
  expect(out).toContain('DB_HOST=localhost')
  expect(out).toContain(ph('1:db-password'))
  expect(out).toContain(ph('2:some-id'))
  expect(out).not.toContain(RANDOM)
})

test("Laravel's default config values stay readable", async ($, on) => {
  const env = 'SESSION_ENCRYPT=false\nDB_CONNECTION=sqlite\nSESSION_DRIVER=database\nAPP_KEY=base64:' + RANDOM + RANDOM + '\n'
  on('tool.call', () => bash(env))

  const out = JSON.stringify(await $.tool.call({ tool: 'Bash', command: 'cat .env' }))

  expect(out).toContain('SESSION_ENCRYPT=false')
  expect(out).toContain('DB_CONNECTION=sqlite')
  expect(out).toContain('SESSION_DRIVER=database')
  expect(out).toContain(ph('1:app-key'))
})

test('a multi-suffix .env file is parsed on read', async ($, on) => {
  on('tool.call', () => bash('DB_PASS=hunter2xyz\n'))

  const out = JSON.stringify(await $.tool.call({ tool: 'Bash', command: 'cat .env.production.local' }))

  expect(out).not.toContain('hunter2xyz')
})

test('env file paths', () => {
  expect(isEnvFilePath('/app/.env')).toBe(true)
  expect(isEnvFilePath('/app/.env.local')).toBe(true)
  expect(isEnvFilePath('/app/.env.production.local')).toBe(true)
  expect(isEnvFilePath('/app/.env.example')).toBe(false)
  expect(isEnvFilePath('/app/.env.local.example')).toBe(false)
  expect(isEnvFilePath('/app/environment.ts')).toBe(false)
})

test('a short value is not masked everywhere and placeholders never nest', () => {
  const vault = new Vault()
  vault.addUser('a')
  vault.addUser('session')
  vault.detectEnvFile('DATABASE_PASSWORD=hunter2-long\n')

  expect(vault.maskKnown('a banana')).toBe('a banana')
  const out = vault.maskKnown('pw hunter2-long in session')
  expect(out).toBe(`pw ${ph('3:database-password')} in ${ph('2:user')}`)
})

test('quoted values with a trailing comment keep only the value', () => {
  const vault = new Vault()
  vault.detectEnvFile('API_TOKEN="hunter2-long" # prod\n')

  expect(vault.list()[0]?.value).toBe('hunter2-long')
})

test('paths, host names and app names in a .env stay readable', async ($, on) => {
  const env = [
    'PROJECT_ROOT=/Users/someone/code/project-with-a-long-name',
    'DB_HOST=mydb.cluster-abc.eu-west-1.rds.amazonaws.com',
    'SESSION_COOKIE=laravel_session',
    'AUTH_MODEL=App\\Models\\User',
    'APP_NAME=MyCompanyPortal2024',
    '',
  ].join('\n')
  on('tool.call', () => bash(env))

  const out = JSON.stringify(await $.tool.call({ tool: 'Bash', command: 'cat .env' }))

  expect(out).not.toContain('SECRET_')
})

test('a base64 app key with slashes is still masked', () => {
  const vault = new Vault()
  vault.detectEnvFile('APP_KEY=base64:Qk9w/aG+Zx9qP2mW7vT4kR8n/B3Lf6Hd1sYc=\n')

  expect(vault.list().length).toBe(1)
})

test('a statement terminator is not taken as part of the secret', () => {
  const vault = new Vault()
  vault.detect('export API_TOKEN=zq81LmXrTw44; echo ok')
  vault.detect('{ API_KEY: zq81LmXrTw55, other: 1 }')

  expect(vault.list().map(s => s.value)).toEqual(['zq81LmXrTw44', 'zq81LmXrTw55'])
  expect(vault.maskKnown('value: zq81LmXrTw44')).not.toContain('zq81LmXrTw44')
})

test('ordinary code constants are not taken as secrets', () => {
  const vault = new Vault()
  vault.detect("SORT_KEY: 'created_at_desc', PRIMARY_KEY: 'identifier', API_KEY_HEADER = 'x-api-key-name'")
  vault.detect('API_TOKEN = os.environ.get("API_TOKEN")\nconst API_KEY = process.env.API_KEY;\nDB_PASSWORD = getpass.getpass()')

  expect(vault.list().length).toBe(0)
})

test('a webhook or DSN URL under a clearly secret name is masked', () => {
  const vault = new Vault()
  vault.detectEnvFile('SLACK_WEBHOOK_SECRET=https://hooks.slack.com/services/T000/B000/Zx9qP2mW7vT4kR8nB3Lf6Hd1\nSENTRY_DSN=https://abc123def456@o12345.ingest.sentry.io/678\nHOMEPAGE=https://example.org/some/long/path/here\n')

  expect(vault.list().map(s => s.label)).toEqual(['slack-webhook-secret', 'sentry-dsn'])
})

test('a password containing brackets is still a secret', () => {
  const vault = new Vault()
  vault.detect('DB_PASSWORD=Xk9(mP2q!vLr7Tz')
  vault.detect('REDIS_PASSWORD: "h3J]w8Qe[Zp5Ns"')
  vault.detect('ADMIN_PASSWORD=Passw0rdX(')

  expect(vault.list().length).toBe(3)
})

test('url password detection stays fast on long dotted text', () => {
  const vault = new Vault()
  const started = Date.now()
  vault.detect('a.'.repeat(100000))

  expect(Date.now() - started).toBeLessThan(500)
})
