@echo off
setlocal
set POWERSHELL_EXE=%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe
if not exist "%POWERSHELL_EXE%" set POWERSHELL_EXE=C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe
"%POWERSHELL_EXE%" -NoProfile -ExecutionPolicy Bypass -File "%~dp0codex-shell-smoke-test.ps1"
exit /b %ERRORLEVEL%
