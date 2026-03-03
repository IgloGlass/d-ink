# Codex Shell Repair (Windows)

Use this when Codex cannot execute PowerShell commands and falls back to `cmd` due to PATH or shell discovery issues.

## 1) Repair environment

Run from repository root:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\repair-codex-shell.ps1
```

If PATH is broken, run the wrapper instead:

```cmd
.\scripts\repair-codex-shell.cmd
```

What it fixes:
- Normalizes the user PATH with required Windows shell directories
- Restores `ComSpec` to `C:\Windows\System32\cmd.exe` when invalid
- Ensures process PATH includes the repaired entries
- Disables `HKCU\Software\Microsoft\Command Processor\AutoRun` (with backup) to prevent non-interactive shell failures
- Verifies `cmd.exe`, `powershell.exe`, and `pwsh.exe` discovery

## 2) Validate

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\codex-shell-smoke-test.ps1
```

Or:

```cmd
.\scripts\codex-shell-smoke-test.cmd
```

Expected result:
- PowerShell command runs with exit code `0`
- `cmd.exe` command runs with exit code `0`
- `Get-Command` resolves `cmd.exe` and `powershell.exe`

## 3) Restart Codex

Close and reopen Codex after running repair so new sessions pick up the updated user environment.

## 4) Optional manual check for AutoRun

```cmd
reg query "HKCU\Software\Microsoft\Command Processor" /v AutoRun
```

Expected result after repair:
- `ERROR: The system was unable to find the specified registry key or value.`
