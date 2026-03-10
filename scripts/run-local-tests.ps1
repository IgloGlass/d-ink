Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent $scriptRoot
. (Join-Path $scriptRoot "local-dev-helpers.ps1")

Set-Location -LiteralPath $repoRoot

Write-Host ""
Write-Host "Running D.ink local tests" -ForegroundColor Cyan
Write-Host "-------------------------" -ForegroundColor Cyan
Write-Host ""

Invoke-PnpmLike -Arguments @("test")
if ($LASTEXITCODE -ne 0) {
    throw "Local tests failed."
}

Write-Host ""
Write-Host "Local tests passed." -ForegroundColor Green
