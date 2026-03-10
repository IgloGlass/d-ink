function Add-PathEntryIfMissing {
    param(
        [Parameter(Mandatory = $true)]
        [string]$PathEntry
    )

    if (-not (Test-Path -LiteralPath $PathEntry)) {
        return
    }

    $currentEntries = $env:PATH -split ';'
    if ($currentEntries -contains $PathEntry) {
        return
    }

    $env:PATH = "$PathEntry;$env:PATH"
}

function Get-NvmNodePathFromSettings {
    $nvmHome = [System.Environment]::GetEnvironmentVariable("NVM_HOME", "User")
    if ([string]::IsNullOrWhiteSpace($nvmHome)) {
        return $null
    }

    $settingsPath = Join-Path $nvmHome "settings.txt"
    if (-not (Test-Path -LiteralPath $settingsPath)) {
        return $null
    }

    foreach ($line in Get-Content -LiteralPath $settingsPath) {
        if ($line -like "path:*") {
            return $line.Substring(5).Trim()
        }
    }

    return $null
}

function Initialize-NodeCommandPath {
    $candidatePaths = @(
        [System.Environment]::GetEnvironmentVariable("NVM_SYMLINK", "User"),
        [System.Environment]::GetEnvironmentVariable("NVM_SYMLINK", "Process"),
        (Get-NvmNodePathFromSettings)
    ) | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }

    foreach ($candidatePath in $candidatePaths) {
        if (Test-Path -LiteralPath (Join-Path $candidatePath "node.exe")) {
            Add-PathEntryIfMissing -PathEntry $candidatePath
            return
        }
    }
}

function Resolve-NodeExecutablePath {
    Initialize-NodeCommandPath

    $candidatePaths = @(
        [System.Environment]::GetEnvironmentVariable("NVM_SYMLINK", "User"),
        [System.Environment]::GetEnvironmentVariable("NVM_SYMLINK", "Process"),
        (Get-NvmNodePathFromSettings)
    ) | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }

    foreach ($candidatePath in $candidatePaths) {
        $nodeExePath = Join-Path $candidatePath "node.exe"
        if (Test-Path -LiteralPath $nodeExePath) {
            return $nodeExePath
        }
    }

    $nodeCommand = Get-Command node -ErrorAction SilentlyContinue
    if ($null -ne $nodeCommand -and $nodeCommand.Source -like "*.exe") {
        return $nodeCommand.Source
    }

    return $null
}

function Resolve-PnpmExecutablePath {
    $nodeExecutablePath = Resolve-NodeExecutablePath
    if (-not [string]::IsNullOrWhiteSpace($nodeExecutablePath)) {
        $nodeHome = Split-Path -Parent $nodeExecutablePath
        $pnpmCmdPath = Join-Path $nodeHome "pnpm.CMD"
        if (Test-Path -LiteralPath $pnpmCmdPath) {
            return $pnpmCmdPath
        }
    }

    $pnpmCommand = Get-Command pnpm -ErrorAction SilentlyContinue
    if ($null -ne $pnpmCommand) {
        return $pnpmCommand.Source
    }

    $nvmSymlink = [System.Environment]::GetEnvironmentVariable("NVM_SYMLINK", "User")
    if (-not [string]::IsNullOrWhiteSpace($nvmSymlink)) {
        $pnpmCmdPath = Join-Path $nvmSymlink "pnpm.CMD"
        if (Test-Path -LiteralPath $pnpmCmdPath) {
            return $pnpmCmdPath
        }
    }

    return $null
}

function Invoke-PnpmLike {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Arguments
    )

    $pnpmExecutablePath = Resolve-PnpmExecutablePath
    if (-not [string]::IsNullOrWhiteSpace($pnpmExecutablePath)) {
        & $pnpmExecutablePath @Arguments
        return
    }

    $corepackCommand = Get-Command corepack -ErrorAction SilentlyContinue
    if ($null -ne $corepackCommand) {
        & $corepackCommand.Source pnpm @Arguments
        return
    }

    throw "Neither pnpm nor corepack is available. Install pnpm or Node.js with Corepack enabled."
}
