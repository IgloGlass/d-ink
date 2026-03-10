@echo off
setlocal
set POWERSHELL_EXE=%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe
if not exist "%POWERSHELL_EXE%" set POWERSHELL_EXE=C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe
"%POWERSHELL_EXE%" -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-local-dev.ps1"
if errorlevel 1 (
  echo.
  echo Local start failed.
  echo Read the diagnostics above, then run check-local-app.cmd for details.
  pause
  exit /b %ERRORLEVEL%
)
echo.
echo Local app stopped. Run start-local-dev.cmd again to restart it.
pause
