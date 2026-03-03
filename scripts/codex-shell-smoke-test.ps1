Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Assert-ExitCode {
    param(
        [Parameter(Mandatory = $true)]
        [int]$Expected,

        [Parameter(Mandatory = $true)]
        [string]$Label
    )

    if ($LASTEXITCODE -ne $Expected) {
        throw "$Label failed with exit code $LASTEXITCODE (expected $Expected)."
    }
}

Write-Host "1) PowerShell check"
powershell.exe -NoProfile -Command '$PSVersionTable.PSVersion.ToString() | Out-Host'
Assert-ExitCode -Expected 0 -Label "PowerShell command"

Write-Host "2) cmd.exe check"
cmd.exe /d /c "echo cmd_ok"
Assert-ExitCode -Expected 0 -Label "cmd command"

Write-Host "3) PATH resolution check"
powershell.exe -NoProfile -Command "Get-Command cmd.exe, powershell.exe | Select-Object Name, Source | Format-Table -AutoSize"
Assert-ExitCode -Expected 0 -Label "PATH resolution"

Write-Host "Smoke test complete."
