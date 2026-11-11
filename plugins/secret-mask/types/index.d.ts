export type Secret = {
  n: number
  value: string
  label: string
  isAllowed: boolean
}

declare module 'claude-code' {
  interface PluginState {
    'secret-mask': { secrets: Shaped<Secret[]> }
  }
}
