# Platform-Specific Commands

## Contents
- Scanning ports
- Checking a single port
- Finding a free port
- Killing a process

## Scanning ports

**macOS/Linux:**

```bash
lsof -iTCP -sTCP:LISTEN -nP 2>/dev/null | grep -E ':(3[0-9]{3}|4[0-3][0-9]{2}|4321|5[0-1][0-9]{2}|5173|8[0-9]{3})' | sort -t: -k2 -n
```

**Windows (PowerShell):**

```powershell
Get-NetTCPConnection -State Listen | Where-Object { $_.LocalPort -ge 3000 -and $_.LocalPort -le 9000 } | Sort-Object LocalPort | Format-Table LocalPort, OwningProcess, @{N='Process';E={(Get-Process -Id $_.OwningProcess).ProcessName}}
```

**Platform detection:** Check `command -v lsof`. If unavailable, fall back to `netstat -ano` or `Get-NetTCPConnection`.

## Checking a single port

**macOS/Linux:**

```bash
lsof -iTCP:<port> -sTCP:LISTEN -nP 2>/dev/null
```

**Windows (PowerShell):**

```powershell
Get-NetTCPConnection -LocalPort <port> | ForEach-Object { Get-Process -Id $_.OwningProcess } | Format-Table Id, ProcessName, Path
```

## Finding a free port

**macOS/Linux:**

```bash
check_port() {
  lsof -iTCP:"$1" -sTCP:LISTEN -nP 2>/dev/null | grep -q ":$1" && return 1 || return 0
}

find_free_port() {
  local port="${1:-3000}"
  while ! check_port "$port"; do
    port=$((port + 1))
  done
  echo "$port"
}
```

**Windows (PowerShell):**

```powershell
function Find-FreePort($start = 3000) {
  $port = $start
  while (Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue) { $port++ }
  return $port
}
```

## Killing a process

**macOS/Linux:**

```bash
kill <pid>
```

**Windows (PowerShell):**

```powershell
Stop-Process -Id <pid>
```

Prefer `kill` (SIGTERM) over `kill -9` (SIGKILL) to allow graceful shutdown. Only escalate to `kill -9` if the process doesn't exit within 3 seconds.
