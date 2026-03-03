Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Split-PathList {
    param(
        [Parameter(Mandatory = $false)]
        [string]$Value
    )

    if ([string]::IsNullOrWhiteSpace($Value)) {
        return @()
    }

    return @(
        ($Value -split ";") |
            ForEach-Object { $_.Trim() } |
            Where-Object { $_ -ne "" }
    )
}

function Join-UniquePathList {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Entries
    )

    $seen = New-Object "System.Collections.Generic.HashSet[string]" ([System.StringComparer]::OrdinalIgnoreCase)
    $result = New-Object "System.Collections.Generic.List[string]"

    foreach ($entry in $Entries) {
        if ([string]::IsNullOrWhiteSpace($entry)) {
            continue
        }

        $normalized = [Environment]::ExpandEnvironmentVariables($entry.Trim())
        if ([string]::IsNullOrWhiteSpace($normalized)) {
            continue
        }

        if ($seen.Add($normalized)) {
            $result.Add($normalized)
        }
    }

    return ($result -join ";")
}

function Ensure-UserEnvironmentVariable {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Name,

        [Parameter(Mandatory = $true)]
        [string]$Value
    )

    [Environment]::SetEnvironmentVariable($Name, $Value, [EnvironmentVariableTarget]::User)
    Set-Item -Path "Env:$Name" -Value $Value
}

function Disable-CmdAutoRunForCurrentUser {
    # Codex and other non-interactive runners can fail if Command Processor AutoRun
    # injects custom batch/PowerShell logic. We preserve and then remove it.
    $regPath = "HKCU:\Software\Microsoft\Command Processor"
    if (-not (Test-Path -LiteralPath $regPath)) {
        return
    }

    $props = Get-ItemProperty -LiteralPath $regPath -ErrorAction SilentlyContinue
    if ($null -eq $props) {
        return
    }

    $autoRun = $props.AutoRun
    if ([string]::IsNullOrWhiteSpace($autoRun)) {
        return
    }

    Set-ItemProperty -LiteralPath $regPath -Name "AutoRunBackup_Codex" -Value $autoRun
    Remove-ItemProperty -LiteralPath $regPath -Name "AutoRun" -ErrorAction SilentlyContinue
    Write-Warning ("Disabled HKCU cmd AutoRun. Previous value saved to AutoRunBackup_Codex: " + $autoRun)
}

$machinePath = [Environment]::GetEnvironmentVariable("Path", [EnvironmentVariableTarget]::Machine)
$userPath = [Environment]::GetEnvironmentVariable("Path", [EnvironmentVariableTarget]::User)
$processPath = [Environment]::GetEnvironmentVariable("Path", [EnvironmentVariableTarget]::Process)

$systemRoot = $env:SystemRoot
if ([string]::IsNullOrWhiteSpace($systemRoot)) {
    $systemRoot = [Environment]::GetEnvironmentVariable("SystemRoot", [EnvironmentVariableTarget]::Machine)
}
if ([string]::IsNullOrWhiteSpace($systemRoot)) {
    $systemRoot = "C:\Windows"
}

$requiredPathEntries = @(
    "$systemRoot\system32",
    "$systemRoot",
    "$systemRoot\System32\Wbem",
    "$systemRoot\System32\WindowsPowerShell\v1.0"
)

$pwsh7 = "C:\Program Files\PowerShell\7"
if (Test-Path -LiteralPath $pwsh7) {
    $requiredPathEntries += $pwsh7
}

# Include common developer tool directories when they exist so Codex can resolve
# frequently used binaries (git, node, python, rg) without shell fallbacks.
$userProfile = [Environment]::GetFolderPath("UserProfile")
$optionalToolDirs = @(
    "C:\Program Files\Git\cmd",
    "C:\Program Files\Git\bin",
    "C:\Program Files\nodejs",
    "$userProfile\AppData\Local\Programs\Python",
    "$userProfile\AppData\Local\Microsoft\WinGet\Packages",
    "$userProfile\.cargo\bin",
    "$userProfile\scoop\shims"
)

foreach ($dir in $optionalToolDirs) {
    if (Test-Path -LiteralPath $dir) {
        $requiredPathEntries += $dir
    }
}

$pythonRoot = "$userProfile\AppData\Local\Programs\Python"
if (Test-Path -LiteralPath $pythonRoot) {
    $pythonInstalls = Get-ChildItem -LiteralPath $pythonRoot -Directory -ErrorAction SilentlyContinue
    foreach ($install in $pythonInstalls) {
        if (Test-Path -LiteralPath (Join-Path $install.FullName "python.exe")) {
            $requiredPathEntries += $install.FullName
            $scriptsDir = Join-Path $install.FullName "Scripts"
            if (Test-Path -LiteralPath $scriptsDir) {
                $requiredPathEntries += $scriptsDir
            }
        }
    }
}

# Keep PATH stable and deterministic for this process.
$mergedForProcess = Join-UniquePathList -Entries @(
    $requiredPathEntries
    (Split-PathList -Value $machinePath)
    (Split-PathList -Value $userPath)
    (Split-PathList -Value $processPath)
)
Ensure-UserEnvironmentVariable -Name "Path" -Value (
    Join-UniquePathList -Entries @(
        (Split-PathList -Value $userPath)
        $requiredPathEntries
    )
)
Set-Item -Path "Env:Path" -Value $mergedForProcess

$cmdPath = "$systemRoot\System32\cmd.exe"
if (-not (Test-Path -LiteralPath $cmdPath)) {
    throw "Expected cmd.exe was not found at '$cmdPath'."
}

$currentComSpec = [Environment]::GetEnvironmentVariable("ComSpec", [EnvironmentVariableTarget]::User)
if ([string]::IsNullOrWhiteSpace($currentComSpec) -or -not (Test-Path -LiteralPath $currentComSpec)) {
    Ensure-UserEnvironmentVariable -Name "ComSpec" -Value $cmdPath
}
Set-Item -Path "Env:ComSpec" -Value $cmdPath

if ([string]::IsNullOrWhiteSpace($env:SystemRoot)) {
    Set-Item -Path "Env:SystemRoot" -Value $systemRoot
}
if ([string]::IsNullOrWhiteSpace($env:windir)) {
    Set-Item -Path "Env:windir" -Value $systemRoot
}

Disable-CmdAutoRunForCurrentUser

$requiredPathExt = @(".COM", ".EXE", ".BAT", ".CMD", ".PS1")
$currentPathExt = [Environment]::GetEnvironmentVariable("PATHEXT", [EnvironmentVariableTarget]::User)
$pathExtEntries = Split-PathList -Value $currentPathExt
if (@($pathExtEntries).Count -eq 0) {
    $pathExtEntries = @(".COM", ".EXE", ".BAT", ".CMD")
}
foreach ($ext in $requiredPathExt) {
    if (-not ($pathExtEntries -contains $ext)) {
        $pathExtEntries += $ext
    }
}
Ensure-UserEnvironmentVariable -Name "PATHEXT" -Value ((@($pathExtEntries) | ForEach-Object { $_.ToUpperInvariant() }) -join ";")

$checks = @(
    @{ Name = "cmd.exe"; Command = "cmd.exe"; Required = $true },
    @{ Name = "Windows PowerShell"; Command = "powershell.exe"; Required = $true },
    @{ Name = "PowerShell 7"; Command = "pwsh.exe"; Required = $false },
    @{ Name = "git"; Command = "git.exe"; Required = $false },
    @{ Name = "rg"; Command = "rg.exe"; Required = $false }
)

$failedRequired = @()
$failedOptional = @()
foreach ($check in $checks) {
    $resolved = $null
    try {
        $resolved = Get-Command $check.Command -ErrorAction Stop
    }
    catch {
        if ($check.Required) {
            $failedRequired += $check.Name
        }
        else {
            $failedOptional += $check.Name
        }
        continue
    }

    Write-Host ("OK   {0}: {1}" -f $check.Name, $resolved.Source)
}

Write-Host ""
Write-Host "Environment repair complete."
Write-Host "User PATH and ComSpec were normalized."

if (@($failedOptional).Count -gt 0) {
    Write-Warning ("Optional executables not found: " + ($failedOptional -join ", "))
}

if (@($failedRequired).Count -gt 0) {
    throw ("Missing required executables after repair: " + ($failedRequired -join ", "))
}
