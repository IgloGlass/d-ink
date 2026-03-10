param(
    [Parameter(Mandatory = $true, Position = 0)]
    [string]$ToolPath,

    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$ToolArguments = @()
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
. (Join-Path $scriptRoot "local-dev-helpers.ps1")

$repoRoot = Split-Path -Parent $scriptRoot
Set-Location -LiteralPath $repoRoot

$nodeExecutablePath = Resolve-NodeExecutablePath
if ([string]::IsNullOrWhiteSpace($nodeExecutablePath)) {
    throw "Node.js could not be resolved. Install Node 20.x or 22.x, or repair the local shell environment."
}

$resolvedToolPath = Join-Path $repoRoot $ToolPath
if (-not (Test-Path -LiteralPath $resolvedToolPath)) {
    throw "Local tool not found: $resolvedToolPath"
}

& $nodeExecutablePath $resolvedToolPath @ToolArguments
exit $LASTEXITCODE
