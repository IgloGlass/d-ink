@echo off
setlocal
set POWERSHELL_EXE=%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe
if not exist "%POWERSHELL_EXE%" set POWERSHELL_EXE=C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe
"%POWERSHELL_EXE%" -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\run-local-tests.ps1"
if errorlevel 1 (
  echo.
  echo Local tests failed.
  echo Read the messages above for the first failing step.
  pause
  exit /b %ERRORLEVEL%
)
echo.
pause
