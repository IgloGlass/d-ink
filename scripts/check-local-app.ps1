Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent $scriptRoot
. (Join-Path $scriptRoot "local-dev-helpers.ps1")
Set-Location -LiteralPath $repoRoot

function Get-DevVarsMap {
    $devVarsPath = Join-Path $repoRoot ".dev.vars"
    $values = @{}
    if (-not (Test-Path -LiteralPath $devVarsPath)) {
        return $values
    }

    foreach ($line in Get-Content -LiteralPath $devVarsPath) {
        if ([string]::IsNullOrWhiteSpace($line) -or $line.TrimStart().StartsWith("#")) {
            continue
        }

        $separatorIndex = $line.IndexOf("=")
        if ($separatorIndex -lt 1) {
            continue
        }

        $key = $line.Substring(0, $separatorIndex).Trim()
        $value = $line.Substring($separatorIndex + 1).Trim()
        if (-not [string]::IsNullOrWhiteSpace($key)) {
            $values[$key] = $value
        }
    }

    return $values
}

function Get-DevVarValue {
    param([hashtable]$DevVars, [string]$Key)
    if ($DevVars.ContainsKey($Key)) {
        return [string]$DevVars[$Key]
    }
    return $null
}

function Invoke-WebRequestCompat {
    param([hashtable]$Parameters)

    $effectiveParameters = @{}
    foreach ($key in $Parameters.Keys) {
        $effectiveParameters[$key] = $Parameters[$key]
    }

    $command = Get-Command Invoke-WebRequest -ErrorAction SilentlyContinue
    if ($null -ne $command -and $command.Parameters.ContainsKey("UseBasicParsing")) {
        $effectiveParameters["UseBasicParsing"] = $true
    }

    return Invoke-WebRequest @effectiveParameters
}

function ConvertFrom-JsonCompat {
    param([string]$JsonText)

    $command = Get-Command ConvertFrom-Json -ErrorAction SilentlyContinue
    if ($null -ne $command -and $command.Parameters.ContainsKey("Depth")) {
        return $JsonText | ConvertFrom-Json -Depth 20
    }

    return $JsonText | ConvertFrom-Json
}

function Invoke-HttpProbe {
    param([string]$Url, [int]$TimeoutSec)

    $params = @{
        Uri = $Url
        Method = "GET"
        TimeoutSec = $TimeoutSec
        Headers = @{ "Cache-Control" = "no-store" }
    }

    $command = Get-Command Invoke-WebRequest -ErrorAction SilentlyContinue
    if ($null -ne $command -and $command.Parameters.ContainsKey("SkipHttpErrorCheck")) {
        $params["SkipHttpErrorCheck"] = $true
    }

    try {
        $response = Invoke-WebRequestCompat -Parameters $params
        return [PSCustomObject]@{
            Reachable = $true
            StatusCode = [int]$response.StatusCode
            Content = [string]$response.Content
            Headers = $response.Headers
            ErrorMessage = $null
        }
    }
    catch {
        $webResponse = $_.Exception.Response
        if ($null -ne $webResponse) {
            $statusCode = $null
            try { $statusCode = [int]$webResponse.StatusCode } catch {}

            $content = ""
            try {
                $stream = $webResponse.GetResponseStream()
                if ($null -ne $stream) {
                    $reader = New-Object System.IO.StreamReader($stream)
                    $content = $reader.ReadToEnd()
                    $reader.Close()
                }
            }
            catch {}

            return [PSCustomObject]@{
                Reachable = $true
                StatusCode = $statusCode
                Content = $content
                Headers = $webResponse.Headers
                ErrorMessage = $_.Exception.Message
            }
        }

        return [PSCustomObject]@{
            Reachable = $false
            StatusCode = $null
            Content = ""
            Headers = $null
            ErrorMessage = $_.Exception.Message
        }
    }
}

function Get-RuntimeHealth {
    param([string]$ApiBaseUrl)

    $url = ($ApiBaseUrl.TrimEnd('/')) + "/v1/workspaces/annual-report-runtime"
    $probe = Invoke-HttpProbe -Url $url -TimeoutSec 3

    $mode = "unavailable"
    $available = $false
    $inlineFallbackEnabled = $false
    $missingBindings = @()

    if ($probe.Reachable -and -not [string]::IsNullOrWhiteSpace($probe.Content)) {
        try {
            $payload = ConvertFrom-JsonCompat -JsonText $probe.Content
            if ($null -ne $payload.processing) {
                $available = $payload.processing.available -eq $true
                if (-not [string]::IsNullOrWhiteSpace([string]$payload.processing.mode)) {
                    $mode = [string]$payload.processing.mode
                }
                if ($payload.processing.inlineFallbackEnabled -eq $true) {
                    $inlineFallbackEnabled = $true
                }
                if ($payload.processing.missingBindings -is [System.Array]) {
                    $missingBindings = @($payload.processing.missingBindings)
                }
            }
        }
        catch {}
    }

    return [PSCustomObject]@{
        Url = $url
        Reachable = $probe.Reachable
        StatusCode = $probe.StatusCode
        ProcessingMode = $mode
        ProcessingAvailable = $available
        InlineFallbackEnabled = $inlineFallbackEnabled
        MissingBindings = $missingBindings
        ErrorMessage = $probe.ErrorMessage
    }
}

function Get-SessionHealth {
    param([string]$ApiBaseUrl)
    $url = ($ApiBaseUrl.TrimEnd('/')) + "/v1/auth/session/current"
    $probe = Invoke-HttpProbe -Url $url -TimeoutSec 3
    return [PSCustomObject]@{ Url = $url; Reachable = $probe.Reachable; StatusCode = $probe.StatusCode; ErrorMessage = $probe.ErrorMessage }
}

function Get-WebHealth {
    param([string]$WebBaseUrl)
    $url = ($WebBaseUrl.TrimEnd('/')) + "/src/client/main.tsx"
    $probe = Invoke-HttpProbe -Url $url -TimeoutSec 3
    $module = $probe.Reachable -and -not [string]::IsNullOrWhiteSpace($probe.Content) -and $probe.Content.Contains('/src/client')
    return [PSCustomObject]@{ Url = $url; Reachable = $probe.Reachable; StatusCode = $probe.StatusCode; HasModuleContent = $module; ErrorMessage = $probe.ErrorMessage }
}

function Get-ListenerRecords {
    param([int]$Port)

    $records = @{}
    $getNetTcpConnection = Get-Command Get-NetTCPConnection -ErrorAction SilentlyContinue
    if ($null -ne $getNetTcpConnection) {
        try {
            $connections = @(Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction Stop)
        }
        catch {
            $connections = @()
        }

        foreach ($connection in $connections) {
            $processId = [int]$connection.OwningProcess
            if ($processId -eq 0) {
                continue
            }
            $records[$processId] = $true
        }

        if ($records.Count -gt 0) {
            return @($records.Keys | Sort-Object)
        }
    }

    $pattern = ":{0}" -f $Port
    $records = @{}
    foreach ($line in @(netstat -ano -p TCP)) {
        if ($line -notmatch '^\s*TCP\s+') { continue }

        $columns = $line -split '\s+'
        if ($columns.Count -lt 5) { continue }

        if ($columns[3] -ne "LISTENING") { continue }
        if (-not $columns[1].EndsWith($pattern)) { continue }

        $parsedProcessId = 0
        if (-not [int]::TryParse($columns[4], [ref]$parsedProcessId)) { continue }
        if ($parsedProcessId -eq 0) { continue }
        $records[$parsedProcessId] = $true
    }

    return @($records.Keys | Sort-Object)
}

function Get-CommandLineByPid {
    param([int]$ProcessId)

    try {
        $proc = Get-CimInstance Win32_Process -Filter "ProcessId = $ProcessId"
        if ($null -eq $proc) { return $null }
        return [string]$proc.CommandLine
    }
    catch {
        return $null
    }
}

function Write-CheckResult {
    param([bool]$Passed, [string]$Label, [string]$Details)

    $prefix = if ($Passed) { "[OK]" } else { "[!]" }
    $color = if ($Passed) { "Green" } else { "Yellow" }
    if ([string]::IsNullOrWhiteSpace($Details)) {
        Write-Host "$prefix $Label" -ForegroundColor $color
        return
    }

    Write-Host "$prefix $Label - $Details" -ForegroundColor $color
}

$devVars = Get-DevVarsMap
$webBaseUrl = Get-DevVarValue -DevVars $devVars -Key "APP_BASE_URL"
if ([string]::IsNullOrWhiteSpace($webBaseUrl)) { $webBaseUrl = "http://localhost:5173" }

$apiBaseUrl = Get-DevVarValue -DevVars $devVars -Key "DINK_API_PROXY_TARGET"
if ([string]::IsNullOrWhiteSpace($apiBaseUrl)) { $apiBaseUrl = "http://127.0.0.1:8787" }

$nodeExecutablePath = Resolve-NodeExecutablePath
$pnpmCommand = Get-Command pnpm -ErrorAction SilentlyContinue
$corepackCommand = Get-Command corepack -ErrorAction SilentlyContinue
$viteCliPath = Join-Path $repoRoot "node_modules\vite\bin\vite.js"
$wranglerCliPath = Join-Path $repoRoot "node_modules\wrangler\bin\wrangler.js"
$hasDevVars = Test-Path -LiteralPath (Join-Path $repoRoot ".dev.vars")

$runtimeHealth = Get-RuntimeHealth -ApiBaseUrl $apiBaseUrl
$sessionHealth = Get-SessionHealth -ApiBaseUrl $apiBaseUrl
$webHealth = Get-WebHealth -WebBaseUrl $webBaseUrl

$apiPort = ([System.Uri]$apiBaseUrl).Port
$apiListeners = @(Get-ListenerRecords -Port $apiPort)
$apiOwnerConflict = $apiListeners.Count -gt 1
$apiOwnerDetails = if ($apiListeners.Count -eq 0) {
    "No listener detected on API port."
}
else {
    ($apiListeners | ForEach-Object {
        $cmd = Get-CommandLineByPid -ProcessId $_
        if ([string]::IsNullOrWhiteSpace($cmd)) {
            "PID $_"
        }
        else {
            "PID $_ => $cmd"
        }
    }) -join " | "
}

$apiEndpointHealthy = $runtimeHealth.Reachable -or $sessionHealth.Reachable
$webEndpointHealthy = $webHealth.Reachable -and $webHealth.HasModuleContent
$singleApiOwner = $apiListeners.Count -eq 1

$pnpmAvailable = $null -ne $pnpmCommand -or $null -ne $corepackCommand
$pnpmDetails = if ($null -ne $pnpmCommand) { $pnpmCommand.Source } elseif ($null -ne $corepackCommand) { "Corepack available as fallback." } else { "Install pnpm or enable Corepack." }
$devVarsDetails = if ($hasDevVars) { "Local secrets file found." } else { "Copy .dev.vars.example to .dev.vars before AI testing." }

$missingBindingsText = if ($runtimeHealth.MissingBindings.Count -gt 0) {
    $runtimeHealth.MissingBindings -join ", "
}
else {
    "none"
}

$runtimeDetails = "mode=$($runtimeHealth.ProcessingMode); available=$($runtimeHealth.ProcessingAvailable); inlineFallbackEnabled=$($runtimeHealth.InlineFallbackEnabled); missingBindings=$missingBindingsText;"
$apiDetails = "runtimeReachable=$($runtimeHealth.Reachable) status=$($runtimeHealth.StatusCode); sessionReachable=$($sessionHealth.Reachable) status=$($sessionHealth.StatusCode)."
$webDetails = "$($webHealth.Url) responded with status $($webHealth.StatusCode); moduleContent=$($webHealth.HasModuleContent)."

Write-Host ""
Write-Host "D.ink local app check" -ForegroundColor Cyan
Write-Host "---------------------" -ForegroundColor Cyan
Write-Host ""

if (-not [string]::IsNullOrWhiteSpace($nodeExecutablePath)) {
    $nodeVersion = (& $nodeExecutablePath -p "process.versions.node") 2>$null
    Write-CheckResult -Passed $true -Label "Node.js found" -Details $nodeVersion
}
else {
    Write-CheckResult -Passed $false -Label "Node.js missing" -Details "Install Node 20.x or 22.x."
}

Write-CheckResult -Passed $pnpmAvailable -Label "pnpm available" -Details $pnpmDetails
Write-CheckResult -Passed (Test-Path -LiteralPath $viteCliPath) -Label "Vite installed locally" -Details $viteCliPath
Write-CheckResult -Passed (Test-Path -LiteralPath $wranglerCliPath) -Label "Wrangler installed locally" -Details $wranglerCliPath
Write-CheckResult -Passed $hasDevVars -Label ".dev.vars present" -Details $devVarsDetails
Write-CheckResult -Passed $apiEndpointHealthy -Label "API endpoint health" -Details $apiDetails
Write-CheckResult -Passed $webEndpointHealthy -Label "Web module health" -Details $webDetails
Write-CheckResult -Passed $singleApiOwner -Label "API port ownership" -Details ("port=$apiPort; listeners=$($apiListeners.Count); details=$apiOwnerDetails")
Write-CheckResult -Passed $runtimeHealth.Reachable -Label "Annual-report runtime endpoint" -Details ("$($runtimeHealth.Url) status=$($runtimeHealth.StatusCode)")
Write-CheckResult -Passed $runtimeHealth.ProcessingAvailable -Label "Annual-report processing" -Details $runtimeDetails

Write-Host ""
if ($apiEndpointHealthy -and $webEndpointHealthy -and $singleApiOwner) {
    Write-Host "The local app looks ready for testing." -ForegroundColor Green
    Write-Host "Open $webBaseUrl in your browser if it is not already open." -ForegroundColor DarkGray
}
else {
    Write-Host "The local app is not fully ready." -ForegroundColor Yellow
    if ($apiOwnerConflict) {
        Write-Host "Multiple API listeners were detected on the same port. Close stale launchers and run start-local-dev.cmd again." -ForegroundColor Yellow
    }
    Write-Host "Start it with start-local-dev.cmd from the repo root, then run this check again." -ForegroundColor DarkGray
}
