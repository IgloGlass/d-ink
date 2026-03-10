Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent $scriptRoot
. (Join-Path $scriptRoot "local-dev-helpers.ps1")
Set-Location -LiteralPath $repoRoot

$config = [PSCustomObject]@{
    CleanupTimeoutSec       = 15
    HealthTimeoutSec        = 75
    BootstrapTimeoutSec     = 8
    MigrateTimeoutSec       = 45
    ProbeIntervalMs         = 700
    StableProbeCount        = 3
    ApiProbeTimeoutSec      = 2
    WebProbeTimeoutSec      = 2
    MaxLogLines             = 40
}

$script:LauncherExitCode = 1
$script:ApiHandle = $null
$script:WebHandle = $null

function Fail-Launcher {
    param([int]$ExitCode, [string]$Message)
    $script:LauncherExitCode = $ExitCode
    throw $Message
}

function Write-Phase {
    param([int]$Step, [int]$Total, [string]$Name, [string]$Details)
    Write-Host ""
    Write-Host ("[{0}/{1}] {2}" -f $Step, $Total, $Name) -ForegroundColor Cyan
    if (-not [string]::IsNullOrWhiteSpace($Details)) {
        Write-Host $Details -ForegroundColor DarkGray
    }
}

function Write-TesterBanner {
    $devVars = Get-DevVarsMap
    $geminiEnabled = -not [string]::IsNullOrWhiteSpace((Get-DevVarValue -DevVars $devVars -Key "GEMINI_API_KEY"))

    Write-Host ""
    Write-Host "D.ink local tester mode" -ForegroundColor Cyan
    Write-Host "-----------------------" -ForegroundColor Cyan
    Write-Host "1. This script starts the web app and local API." -ForegroundColor Gray
    Write-Host "2. Your browser opens automatically when the web app is ready." -ForegroundColor Gray
    Write-Host "3. Keep this window open while testing." -ForegroundColor Gray
    Write-Host "4. Code changes should appear automatically in the open browser tab." -ForegroundColor Gray
    if ($geminiEnabled) {
        Write-Host "5. Gemini AI is enabled for local testing." -ForegroundColor Gray
    }
    Write-Host ""
}

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

function Normalize-DevTenantId {
    param([string]$Value)
    if ([string]::IsNullOrWhiteSpace($Value)) { return $null }

    $trimmed = $Value.Trim()
    if ($trimmed -match '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$') {
        return $trimmed.ToLowerInvariant()
    }
    if ($trimmed -match '^\d{1,12}$') {
        return "00000000-0000-4000-8000-{0}" -f $trimmed.PadLeft(12, '0')
    }
    return $null
}

function Get-PortFromUrl {
    param([string]$Url, [int]$DefaultPort)
    $uri = [System.Uri]$Url
    if ($uri.IsDefaultPort) { return $DefaultPort }
    return $uri.Port
}

function Test-DependencyInstallRequired {
    $nodeModulesPath = Join-Path $repoRoot "node_modules"
    $pnpmModulesStatePath = Join-Path $nodeModulesPath ".modules.yaml"
    $lockfilePath = Join-Path $repoRoot "pnpm-lock.yaml"
    $manifestPath = Join-Path $repoRoot "package.json"

    if (-not (Test-Path -LiteralPath $nodeModulesPath)) { return $true }
    if (-not (Test-Path -LiteralPath $pnpmModulesStatePath)) { return $true }
    if (-not (Test-Path -LiteralPath $lockfilePath)) { return $true }

    $modulesStateTime = (Get-Item -LiteralPath $pnpmModulesStatePath).LastWriteTimeUtc
    $lockfileTime = (Get-Item -LiteralPath $lockfilePath).LastWriteTimeUtc
    $manifestTime = (Get-Item -LiteralPath $manifestPath).LastWriteTimeUtc

    return ($lockfileTime -gt $modulesStateTime) -or ($manifestTime -gt $modulesStateTime)
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
    param([string]$ApiBaseUrl, [int]$TimeoutSec)

    $url = ($ApiBaseUrl.TrimEnd('/')) + "/v1/workspaces/annual-report-runtime"
    $probe = Invoke-HttpProbe -Url $url -TimeoutSec $TimeoutSec

    $mode = "unavailable"
    $available = $false
    $missingBindings = @()

    if ($probe.Reachable -and -not [string]::IsNullOrWhiteSpace($probe.Content)) {
        try {
            $payload = ConvertFrom-JsonCompat -JsonText $probe.Content
            if ($null -ne $payload.processing) {
                $available = $payload.processing.available -eq $true
                if (-not [string]::IsNullOrWhiteSpace([string]$payload.processing.mode)) {
                    $mode = [string]$payload.processing.mode
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
        ProcessingAvailable = $available
        ProcessingMode = $mode
        MissingBindings = $missingBindings
    }
}

function Get-SessionHealth {
    param([string]$ApiBaseUrl, [int]$TimeoutSec)
    $url = ($ApiBaseUrl.TrimEnd('/')) + "/v1/auth/session/current"
    $probe = Invoke-HttpProbe -Url $url -TimeoutSec $TimeoutSec
    return [PSCustomObject]@{ Url = $url; Reachable = $probe.Reachable; StatusCode = $probe.StatusCode }
}

function Get-WebHealth {
    param([string]$WebBaseUrl, [int]$TimeoutSec)
    $url = ($WebBaseUrl.TrimEnd('/')) + "/src/client/main.tsx"
    $probe = Invoke-HttpProbe -Url $url -TimeoutSec $TimeoutSec
    $moduleContent = $probe.Reachable -and -not [string]::IsNullOrWhiteSpace($probe.Content) -and $probe.Content.Contains('/src/client')
    return [PSCustomObject]@{ Url = $url; Reachable = $probe.Reachable; StatusCode = $probe.StatusCode; HasModuleContent = $moduleContent }
}
function Get-ListenerRecords {
    param([int[]]$Ports)

    $records = @{}
    $getNetTcpConnection = Get-Command Get-NetTCPConnection -ErrorAction SilentlyContinue
    if ($null -ne $getNetTcpConnection) {
        foreach ($port in $Ports) {
            try {
                $connections = @(Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction Stop)
            }
            catch {
                $connections = @()
            }

            foreach ($connection in $connections) {
                $pidValue = [int]$connection.OwningProcess
                if ($pidValue -eq 0 -or $pidValue -eq $PID) {
                    continue
                }

                $key = "{0}|{1}" -f $port, $pidValue
                $records[$key] = [PSCustomObject]@{ Port = [int]$port; ProcessId = $pidValue }
            }
        }

        if ($records.Count -gt 0) {
            return @($records.Values | Sort-Object Port, ProcessId)
        }
    }

    $suffixMap = @{}
    foreach ($port in $Ports) {
        $suffixMap[":{0}" -f $port] = [int]$port
    }

    $records = @{}
    foreach ($line in @(netstat -ano -p TCP)) {
        if ($line -notmatch '^\s*TCP\s+') { continue }

        $columns = $line -split '\s+'
        if ($columns.Count -lt 5) { continue }

        $localAddress = $columns[1]
        $state = $columns[3]
        $pidText = $columns[4]
        if ($state -ne "LISTENING") { continue }

        $matchedPort = $null
        foreach ($suffix in $suffixMap.Keys) {
            if ($localAddress.EndsWith($suffix)) {
                $matchedPort = $suffixMap[$suffix]
                break
            }
        }
        if ($null -eq $matchedPort) { continue }

        $pidValue = 0
        if (-not [int]::TryParse($pidText, [ref]$pidValue)) { continue }
        if ($pidValue -eq 0 -or $pidValue -eq $PID) { continue }

        $key = "{0}|{1}" -f $matchedPort, $pidValue
        $records[$key] = [PSCustomObject]@{ Port = $matchedPort; ProcessId = $pidValue }
    }

    return @($records.Values | Sort-Object Port, ProcessId)
}

function Get-ProcessMap {
    $map = @{}
    foreach ($proc in Get-CimInstance Win32_Process) {
        $map[[int]$proc.ProcessId] = $proc
    }
    return $map
}

function Get-ManagedRootPid {
    param([int]$ProcessId, [hashtable]$ProcessMap)

    if (-not $ProcessMap.ContainsKey($ProcessId)) {
        return $ProcessId
    }

    $currentPid = $ProcessId
    $candidatePid = $ProcessId
    $visited = New-Object System.Collections.Generic.HashSet[int]

    while ($ProcessMap.ContainsKey($currentPid)) {
        if (-not $visited.Add($currentPid)) { break }

        $proc = $ProcessMap[$currentPid]
        $name = [string]$proc.Name
        if ($name -ieq "node.exe" -or $name -ieq "workerd.exe") {
            $candidatePid = $currentPid
        }

        $parentPid = [int]$proc.ParentProcessId
        if ($parentPid -le 0 -or -not $ProcessMap.ContainsKey($parentPid)) { break }

        $parentName = [string]$ProcessMap[$parentPid].Name
        if ($parentName -ieq "cmd.exe" -or $parentName -ieq "powershell.exe" -or $parentName -ieq "pwsh.exe" -or $parentName -ieq "explorer.exe") {
            break
        }

        $currentPid = $parentPid
    }

    return $candidatePid
}

function Stop-ProcessTree {
    param([int]$ProcessId, [switch]$Quiet)

    $taskkillPath = Join-Path $env:SystemRoot "System32\taskkill.exe"
    if (Test-Path -LiteralPath $taskkillPath) {
        try {
            & $taskkillPath /PID $ProcessId /T /F *> $null
            if ($LASTEXITCODE -eq 0) {
                return $true
            }
        }
        catch {
            if (-not $Quiet) {
                Write-Warning "taskkill failed for PID $ProcessId."
            }
        }
    }

    try {
        Stop-Process -Id $ProcessId -Force -ErrorAction Stop
        return $true
    }
    catch {
        if (-not $Quiet) {
            Write-Warning "Could not terminate PID $ProcessId."
        }
        return $false
    }
}

function Get-PortOwnerDetails {
    param([int[]]$Ports)
    $listeners = @(Get-ListenerRecords -Ports $Ports)
    if ($listeners.Count -eq 0) { return @() }

    $processMap = Get-ProcessMap
    $details = @()
    foreach ($listener in $listeners) {
        $name = "unknown"
        $commandLine = "command unavailable"
        if ($processMap.ContainsKey($listener.ProcessId)) {
            $proc = $processMap[$listener.ProcessId]
            $name = [string]$proc.Name
            if (-not [string]::IsNullOrWhiteSpace([string]$proc.CommandLine)) {
                $commandLine = [string]$proc.CommandLine
            }
        }
        $details += [PSCustomObject]@{ Port = $listener.Port; ProcessId = $listener.ProcessId; Name = $name; CommandLine = $commandLine }
    }
    return $details
}

function Cleanup-PortsAggressive {
    param([int[]]$Ports, [int]$TimeoutSec)

    $listeners = @(Get-ListenerRecords -Ports $Ports)
    if ($listeners.Count -eq 0) {
        Write-Host "No stale listeners found on required ports." -ForegroundColor DarkGray
        return
    }

    $processMap = Get-ProcessMap
    $roots = New-Object System.Collections.Generic.HashSet[int]

    foreach ($listener in $listeners) {
        $rootPid = Get-ManagedRootPid -ProcessId $listener.ProcessId -ProcessMap $processMap
        [void]$roots.Add($rootPid)
    }

    foreach ($rootPid in $roots) {
        if ($processMap.ContainsKey($rootPid)) {
            $proc = $processMap[$rootPid]
            Write-Host ("Stopping stale process tree root PID {0} ({1})" -f $rootPid, [string]$proc.Name) -ForegroundColor DarkGray
            if (-not [string]::IsNullOrWhiteSpace([string]$proc.CommandLine)) {
                Write-Host ("  Command: {0}" -f [string]$proc.CommandLine) -ForegroundColor DarkGray
            }
        }
        [void](Stop-ProcessTree -ProcessId $rootPid)
    }

    $deadline = (Get-Date).AddSeconds($TimeoutSec)
    while ((Get-Date) -lt $deadline) {
        $remaining = @(Get-ListenerRecords -Ports $Ports)
        if ($remaining.Count -eq 0) {
            Write-Host "Required ports reclaimed." -ForegroundColor DarkGray
            return
        }
        Start-Sleep -Milliseconds 300
    }

    $remainingDetails = @(Get-PortOwnerDetails -Ports $Ports)
    foreach ($detail in $remainingDetails) {
        Write-Warning ("Port {0} still occupied by PID {1} ({2})." -f $detail.Port, $detail.ProcessId, $detail.Name)
        Write-Warning ("Command: {0}" -f $detail.CommandLine)
    }

    Fail-Launcher -ExitCode 20 -Message "Could not reclaim local API/web ports."
}

function New-LoggedProcess {
    param([string]$Label, [string]$FilePath, [string[]]$Arguments, [hashtable]$Environment = @{})

    $startInfo = New-Object System.Diagnostics.ProcessStartInfo
    $startInfo.FileName = $FilePath
    $startInfo.Arguments = [string]::Join(' ', ($Arguments | ForEach-Object { if ($_ -match '\s') { '"' + ($_ -replace '"', '\"') + '"' } else { $_ } }))
    $startInfo.WorkingDirectory = $repoRoot
    $startInfo.UseShellExecute = $false
    $startInfo.RedirectStandardOutput = $true
    $startInfo.RedirectStandardError = $true
    $startInfo.CreateNoWindow = $true
    foreach ($key in $Environment.Keys) { $startInfo.Environment[$key] = [string]$Environment[$key] }

    $proc = New-Object System.Diagnostics.Process
    $proc.StartInfo = $startInfo
    $proc.EnableRaisingEvents = $true

    $logBuffer = [System.Collections.ArrayList]::Synchronized((New-Object System.Collections.ArrayList))
    $maxLines = [int]$config.MaxLogLines

    Register-ObjectEvent -InputObject $proc -EventName OutputDataReceived -Action {
        if (-not [string]::IsNullOrWhiteSpace($EventArgs.Data)) {
            Write-Host "[$using:Label] $($EventArgs.Data)"
            $buffer = $using:logBuffer
            [void]$buffer.Add($EventArgs.Data)
            while ($buffer.Count -gt $using:maxLines) { [void]$buffer.RemoveAt(0) }
        }
    } | Out-Null

    Register-ObjectEvent -InputObject $proc -EventName ErrorDataReceived -Action {
        if (-not [string]::IsNullOrWhiteSpace($EventArgs.Data)) {
            Write-Host "[$using:Label] $($EventArgs.Data)"
            $buffer = $using:logBuffer
            [void]$buffer.Add($EventArgs.Data)
            while ($buffer.Count -gt $using:maxLines) { [void]$buffer.RemoveAt(0) }
        }
    } | Out-Null

    [void]$proc.Start()
    $proc.BeginOutputReadLine()
    $proc.BeginErrorReadLine()

    return [PSCustomObject]@{ Label = $Label; Process = $proc; LogBuffer = $logBuffer }
}

function Stop-LoggedProcess {
    param([AllowNull()][pscustomobject]$Handle)

    if ($null -eq $Handle -or $null -eq $Handle.Process) { return }

    try {
        if (-not $Handle.Process.HasExited) {
            [void](Stop-ProcessTree -ProcessId $Handle.Process.Id -Quiet)
        }
    }
    catch {}

    try {
        Get-EventSubscriber | Where-Object { $_.SourceObject -eq $Handle.Process } | Unregister-Event
    }
    catch {}

    try { $Handle.Process.Dispose() } catch {}
}

function Get-RecentLogs {
    param([pscustomobject]$Handle, [int]$Count = 8)
    if ($null -eq $Handle -or $null -eq $Handle.LogBuffer) { return @() }
    $total = $Handle.LogBuffer.Count
    if ($total -le 0) { return @() }
    $start = [Math]::Max(0, $total - $Count)
    $lines = @()
    for ($i = $start; $i -lt $total; $i++) { $lines += [string]$Handle.LogBuffer[$i] }
    return $lines
}

function Ensure-LocalDatabaseReady {
    param([string]$NodeExecutablePath, [int]$TimeoutSec)

    $wranglerCliPath = Join-Path $repoRoot "node_modules\wrangler\bin\wrangler.js"
    if (-not (Test-Path -LiteralPath $wranglerCliPath)) {
        Fail-Launcher -ExitCode 10 -Message "Wrangler is required to apply local database migrations. Run pnpm install first."
    }

    Write-Host "Preparing local database..." -ForegroundColor DarkGray

    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = $NodeExecutablePath
    $psi.Arguments = ('"{0}" d1 migrations apply DB --local' -f $wranglerCliPath)
    $psi.WorkingDirectory = $repoRoot
    $psi.UseShellExecute = $false
    $psi.RedirectStandardInput = $true
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $psi.CreateNoWindow = $true

    $proc = New-Object System.Diagnostics.Process
    $proc.StartInfo = $psi
    [void]$proc.Start()
    $proc.StandardInput.Write("y`n")
    $proc.StandardInput.Close()

    if (-not $proc.WaitForExit($TimeoutSec * 1000)) {
        [void](Stop-ProcessTree -ProcessId $proc.Id -Quiet)
        Fail-Launcher -ExitCode 30 -Message "Database migration step timed out."
    }

    $stdout = $proc.StandardOutput.ReadToEnd()
    $stderr = $proc.StandardError.ReadToEnd()

    if (-not [string]::IsNullOrWhiteSpace($stdout)) { Write-Host ($stdout.TrimEnd()) }
    if (-not [string]::IsNullOrWhiteSpace($stderr)) { Write-Host ($stderr.TrimEnd()) }

    if ($proc.ExitCode -ne 0) {
        Fail-Launcher -ExitCode 30 -Message ("Database migration failed with exit code {0}." -f $proc.ExitCode)
    }
}
function Wait-ForHealthyStartup {
    param(
        [string]$ApiBaseUrl,
        [string]$WebBaseUrl,
        [int]$ApiPort,
        [int]$TimeoutSec,
        [pscustomobject]$ApiHandle,
        [pscustomobject]$WebHandle
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSec)
    $stablePasses = 0
    $lastProgress = (Get-Date).AddYears(-1)

    $latestRuntime = $null
    $latestSession = $null
    $latestWeb = $null
    $latestOwners = @()

    while ((Get-Date) -lt $deadline) {
        if ($null -ne $ApiHandle -and $null -ne $ApiHandle.Process -and $ApiHandle.Process.HasExited) {
            return [PSCustomObject]@{ Success = $false; Reason = "api_process_exited"; Runtime = $latestRuntime; Session = $latestSession; Web = $latestWeb; Owners = $latestOwners }
        }

        if ($null -ne $WebHandle -and $null -ne $WebHandle.Process -and $WebHandle.Process.HasExited) {
            return [PSCustomObject]@{ Success = $false; Reason = "web_process_exited"; Runtime = $latestRuntime; Session = $latestSession; Web = $latestWeb; Owners = $latestOwners }
        }

        $latestRuntime = Get-RuntimeHealth -ApiBaseUrl $ApiBaseUrl -TimeoutSec $config.ApiProbeTimeoutSec
        $latestSession = Get-SessionHealth -ApiBaseUrl $ApiBaseUrl -TimeoutSec $config.ApiProbeTimeoutSec
        $latestWeb = Get-WebHealth -WebBaseUrl $WebBaseUrl -TimeoutSec $config.WebProbeTimeoutSec
        $latestOwners = @((Get-ListenerRecords -Ports @($ApiPort)) | Select-Object -ExpandProperty ProcessId -Unique)

        $apiReachable = $latestRuntime.Reachable -or $latestSession.Reachable
        $webReachable = $latestWeb.Reachable -and $latestWeb.HasModuleContent
        $singleApiOwner = $latestOwners.Count -eq 1

        if ($apiReachable -and $webReachable -and $singleApiOwner) {
            $stablePasses += 1
        }
        else {
            $stablePasses = 0
        }

        if (((Get-Date) - $lastProgress).TotalSeconds -ge 5) {
            Write-Host (
                "Waiting for readiness: api={0} web={1} apiListeners={2} stable={3}/{4}" -f
                $apiReachable,
                $webReachable,
                $latestOwners.Count,
                $stablePasses,
                $config.StableProbeCount
            ) -ForegroundColor DarkGray
            $lastProgress = Get-Date
        }

        if ($stablePasses -ge $config.StableProbeCount) {
            return [PSCustomObject]@{ Success = $true; Reason = "ready"; Runtime = $latestRuntime; Session = $latestSession; Web = $latestWeb; Owners = $latestOwners }
        }

        Start-Sleep -Milliseconds $config.ProbeIntervalMs
    }

    return [PSCustomObject]@{ Success = $false; Reason = "timeout"; Runtime = $latestRuntime; Session = $latestSession; Web = $latestWeb; Owners = $latestOwners }
}

function Write-StartupDiagnostics {
    param([pscustomobject]$Runtime, [pscustomobject]$Session, [pscustomobject]$Web, [int]$ApiPort, [int]$WebPort, [pscustomobject]$ApiHandle, [pscustomobject]$WebHandle)

    Write-Host ""
    Write-Host "Local launcher diagnostics" -ForegroundColor Yellow
    Write-Host "------------------------" -ForegroundColor Yellow
    if ($null -ne $Runtime) { Write-Host ("API runtime endpoint: {0} (reachable={1}, status={2})" -f $Runtime.Url, $Runtime.Reachable, $Runtime.StatusCode) -ForegroundColor Yellow }
    if ($null -ne $Session) { Write-Host ("API session endpoint: {0} (reachable={1}, status={2})" -f $Session.Url, $Session.Reachable, $Session.StatusCode) -ForegroundColor Yellow }
    if ($null -ne $Web) { Write-Host ("Web module endpoint: {0} (reachable={1}, status={2}, module={3})" -f $Web.Url, $Web.Reachable, $Web.StatusCode, $Web.HasModuleContent) -ForegroundColor Yellow }

    $owners = @(Get-PortOwnerDetails -Ports @($ApiPort, $WebPort))
    if ($owners.Count -gt 0) {
        Write-Host "Port owners:" -ForegroundColor Yellow
        foreach ($owner in $owners) {
            Write-Host ("  port {0} -> PID {1} ({2})" -f $owner.Port, $owner.ProcessId, $owner.Name) -ForegroundColor Yellow
            Write-Host ("    {0}" -f $owner.CommandLine) -ForegroundColor DarkGray
        }
    }

    if ($null -ne $ApiHandle -and $null -ne $ApiHandle.Process) {
        $apiState = if ($ApiHandle.Process.HasExited) { "exited ({0})" -f $ApiHandle.Process.ExitCode } else { "running" }
        Write-Host ("API process: {0}" -f $apiState) -ForegroundColor Yellow
        foreach ($line in @(Get-RecentLogs -Handle $ApiHandle)) { Write-Host ("  {0}" -f $line) -ForegroundColor DarkGray }
    }

    if ($null -ne $WebHandle -and $null -ne $WebHandle.Process) {
        $webState = if ($WebHandle.Process.HasExited) { "exited ({0})" -f $WebHandle.Process.ExitCode } else { "running" }
        Write-Host ("Web process: {0}" -f $webState) -ForegroundColor Yellow
        foreach ($line in @(Get-RecentLogs -Handle $WebHandle)) { Write-Host ("  {0}" -f $line) -ForegroundColor DarkGray }
    }

    Write-Host "Next step: run .\check-local-app.cmd and share the output if startup still fails." -ForegroundColor Yellow
}

function Invoke-ApiJson {
    param([string]$Method, [string]$Url, [Microsoft.PowerShell.Commands.WebRequestSession]$Session, [object]$Body, [int]$TimeoutSec = 2)

    $params = @{ Method = $Method; Uri = $Url; WebSession = $Session; TimeoutSec = $TimeoutSec; Headers = @{ "Cache-Control" = "no-store" } }
    if ($PSBoundParameters.ContainsKey("Body")) {
        $params["ContentType"] = "application/json"
        $params["Body"] = ($Body | ConvertTo-Json -Depth 10 -Compress)
    }

    $response = Invoke-WebRequestCompat -Parameters $params
    if ([string]::IsNullOrWhiteSpace($response.Content)) { return $null }
    return ConvertFrom-JsonCompat -JsonText $response.Content
}

function Ensure-DemoWorkspace {
    param([string]$ApiBaseUrl, [hashtable]$DevVars, [int]$TimeoutSec)

    $deadline = (Get-Date).AddSeconds($TimeoutSec)
    $tenantId = Normalize-DevTenantId -Value (Get-DevVarValue -DevVars $DevVars -Key "DEV_AUTH_DEFAULT_TENANT_ID")
    if ([string]::IsNullOrWhiteSpace($tenantId)) { $tenantId = "00000000-0000-4000-8000-000000005335" }

    $session = New-Object Microsoft.PowerShell.Commands.WebRequestSession

    if ((Get-Date) -gt $deadline) { throw "Demo bootstrap timed out." }
    [void](Invoke-ApiJson -Method "POST" -Url "$ApiBaseUrl/v1/auth/dev-login" -Session $session -Body @{ tenantId = $tenantId; role = "Admin" } -TimeoutSec 2)

    if ((Get-Date) -gt $deadline) { throw "Demo bootstrap timed out." }
    $companiesResponse = Invoke-ApiJson -Method "GET" -Url "$ApiBaseUrl/v1/companies?tenantId=$tenantId" -Session $session -TimeoutSec 2
    $demoCompany = @($companiesResponse.companies) | Where-Object { $_.organizationNumber -eq "5561231234" } | Select-Object -First 1

    if ($null -eq $demoCompany) {
        if ((Get-Date) -gt $deadline) { throw "Demo bootstrap timed out." }
        $createdCompanyResponse = Invoke-ApiJson -Method "POST" -Url "$ApiBaseUrl/v1/companies" -Session $session -Body @{
            tenantId = $tenantId
            legalName = "Test Company AB"
            organizationNumber = "5561231234"
            defaultFiscalYearStart = "2025-01-01"
            defaultFiscalYearEnd = "2025-12-31"
        } -TimeoutSec 2
        $demoCompany = $createdCompanyResponse.company
    }

    if ((Get-Date) -gt $deadline) { throw "Demo bootstrap timed out." }
    $workspacesResponse = Invoke-ApiJson -Method "GET" -Url "$ApiBaseUrl/v1/workspaces?tenantId=$tenantId" -Session $session -TimeoutSec 2
    $demoWorkspace = @($workspacesResponse.workspaces) | Where-Object {
        $_.companyId -eq $demoCompany.id -and $_.fiscalYearStart -eq "2025-01-01" -and $_.fiscalYearEnd -eq "2025-12-31"
    } | Select-Object -First 1

    if ($null -eq $demoWorkspace) {
        if ((Get-Date) -gt $deadline) { throw "Demo bootstrap timed out." }
        $createdWorkspaceResponse = Invoke-ApiJson -Method "POST" -Url "$ApiBaseUrl/v1/workspaces" -Session $session -Body @{
            tenantId = $tenantId
            companyId = $demoCompany.id
            fiscalYearStart = "2025-01-01"
            fiscalYearEnd = "2025-12-31"
        } -TimeoutSec 2
        $demoWorkspace = $createdWorkspaceResponse.workspace
    }

    return [PSCustomObject]@{ CompanyName = $demoCompany.legalName; WorkspaceId = $demoWorkspace.id }
}

function Invoke-Launcher {
    $devVars = Get-DevVarsMap

    $webBaseUrl = Get-DevVarValue -DevVars $devVars -Key "APP_BASE_URL"
    if ([string]::IsNullOrWhiteSpace($webBaseUrl)) { $webBaseUrl = "http://localhost:5173" }

    $apiBaseUrl = Get-DevVarValue -DevVars $devVars -Key "DINK_API_PROXY_TARGET"
    if ([string]::IsNullOrWhiteSpace($apiBaseUrl)) { $apiBaseUrl = "http://127.0.0.1:8787" }

    $webPort = Get-PortFromUrl -Url $webBaseUrl -DefaultPort 5173
    $apiPort = Get-PortFromUrl -Url $apiBaseUrl -DefaultPort 8787

    Write-TesterBanner

    $totalSteps = 8

    Write-Phase -Step 1 -Total $totalSteps -Name "Preflight" -Details "Checking Node/pnpm/tools and dependency state."
    $nodeExecutablePath = Resolve-NodeExecutablePath
    if ([string]::IsNullOrWhiteSpace($nodeExecutablePath)) {
        Fail-Launcher -ExitCode 10 -Message "Node.js could not be resolved. Install Node 20.x or 22.x."
    }

    $nodeVersion = (& $nodeExecutablePath -p "process.versions.node") 2>$null
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($nodeVersion)) {
        Fail-Launcher -ExitCode 10 -Message "Node.js could not be executed from the current shell."
    }

    $nodeMajorVersion = [int](($nodeVersion -split "\.")[0])
    if (($nodeMajorVersion -ne 20) -and ($nodeMajorVersion -ne 22)) {
        Write-Warning "This repo supports Node.js 20.x or 22.x. Current version: $nodeMajorVersion.x"
    }

    $wranglerCliPath = Join-Path $repoRoot "node_modules\wrangler\bin\wrangler.js"
    $viteCliPath = Join-Path $repoRoot "node_modules\vite\bin\vite.js"

    Write-Host "Installing dependencies..." -ForegroundColor Cyan
    if (-not (Test-Path -LiteralPath $wranglerCliPath) -or -not (Test-Path -LiteralPath $viteCliPath) -or (Test-DependencyInstallRequired)) {
        Invoke-PnpmLike -Arguments @("install")
        if ($LASTEXITCODE -ne 0) {
            Fail-Launcher -ExitCode 10 -Message "Dependency installation failed."
        }
    }
    else {
        Write-Host "Dependencies already up to date; skipping install." -ForegroundColor DarkGray
    }

    if (-not (Test-Path -LiteralPath $wranglerCliPath) -or -not (Test-Path -LiteralPath $viteCliPath)) {
        Fail-Launcher -ExitCode 10 -Message "Wrangler or Vite CLI is missing after dependency setup."
    }

    Write-Host ""
    Write-Host "Starting local app..." -ForegroundColor Cyan
    Write-Host "Web: $webBaseUrl" -ForegroundColor DarkGray
    Write-Host "API: $apiBaseUrl" -ForegroundColor DarkGray
    Write-Host "Hot reload: enabled" -ForegroundColor DarkGray

    Write-Phase -Step 2 -Total $totalSteps -Name "Cleanup" -Details "Reclaiming required local ports."
    Cleanup-PortsAggressive -Ports @($apiPort, $webPort) -TimeoutSec $config.CleanupTimeoutSec

    Write-Phase -Step 3 -Total $totalSteps -Name "DB migrate" -Details "Applying local database migrations."
    Ensure-LocalDatabaseReady -NodeExecutablePath $nodeExecutablePath -TimeoutSec $config.MigrateTimeoutSec

    Write-Phase -Step 4 -Total $totalSteps -Name "Start services" -Details "Launching API and web development servers."
    Write-Host "Resolved API proxy target: $apiBaseUrl" -ForegroundColor DarkGray
    $script:ApiHandle = New-LoggedProcess -Label "api" -FilePath $nodeExecutablePath -Arguments @($wranglerCliPath, "dev", "--port", [string]$apiPort)

    Start-Sleep -Milliseconds 350
    $webUri = [System.Uri]$webBaseUrl
    $webHost = if ([string]::IsNullOrWhiteSpace($webUri.Host)) { "127.0.0.1" } else { $webUri.Host }
    Write-Host "Resolved Vite bind host: $webHost" -ForegroundColor DarkGray

    $script:WebHandle = New-LoggedProcess -Label "web" -FilePath $nodeExecutablePath -Arguments @($viteCliPath, "--host", $webHost, "--port", [string]$webPort, "--strictPort") -Environment @{ DINK_API_PROXY_TARGET = $apiBaseUrl }

    Write-Phase -Step 5 -Total $totalSteps -Name "Health gate" -Details "Waiting until API and web endpoints are healthy and stable."
    $health = Wait-ForHealthyStartup -ApiBaseUrl $apiBaseUrl -WebBaseUrl $webBaseUrl -ApiPort $apiPort -TimeoutSec $config.HealthTimeoutSec -ApiHandle $script:ApiHandle -WebHandle $script:WebHandle

    if (-not $health.Success) {
        Write-StartupDiagnostics -Runtime $health.Runtime -Session $health.Session -Web $health.Web -ApiPort $apiPort -WebPort $webPort -ApiHandle $script:ApiHandle -WebHandle $script:WebHandle
        if ($health.Reason -eq "api_process_exited" -or $health.Reason -eq "web_process_exited") {
            Fail-Launcher -ExitCode 60 -Message "A local service exited during startup."
        }
        Fail-Launcher -ExitCode 50 -Message "Startup health checks timed out before the app became ready."
    }

    Write-Phase -Step 6 -Total $totalSteps -Name "Optional demo bootstrap" -Details "Preparing Test Company AB workspace (best effort)."
    $demoWorkspace = $null
    try {
        $demoWorkspace = Ensure-DemoWorkspace -ApiBaseUrl $apiBaseUrl -DevVars $devVars -TimeoutSec $config.BootstrapTimeoutSec
        Write-Host ("Demo workspace ready: {0}" -f $demoWorkspace.CompanyName) -ForegroundColor DarkGray
    }
    catch {
        Write-Warning "Demo bootstrap skipped: $($_.Exception.Message)"
    }

    Write-Phase -Step 7 -Total $totalSteps -Name "Open browser" -Details "Launching the local app in your default browser."
    $browserTarget = $webBaseUrl.TrimEnd('/')
    if ($null -ne $demoWorkspace -and -not [string]::IsNullOrWhiteSpace($demoWorkspace.WorkspaceId)) {
        $browserTarget = "$browserTarget/app/workspaces/$($demoWorkspace.WorkspaceId)"
    }
    Start-Process $browserTarget

    Write-Host ""
    Write-Host "Local app is ready." -ForegroundColor Green
    Write-Host "Browser: $webBaseUrl" -ForegroundColor DarkGray
    Write-Host "API: $apiBaseUrl" -ForegroundColor DarkGray
    Write-Host "Annual-report mode: $($health.Runtime.ProcessingMode)" -ForegroundColor DarkGray

    Write-Phase -Step 8 -Total $totalSteps -Name "Supervise" -Details "Keeping services alive while this window stays open."
    while ($true) {
        Start-Sleep -Seconds 1

        $apiRunning = $null -ne $script:ApiHandle -and $null -ne $script:ApiHandle.Process -and -not $script:ApiHandle.Process.HasExited
        $webRunning = $null -ne $script:WebHandle -and $null -ne $script:WebHandle.Process -and -not $script:WebHandle.Process.HasExited

        if (-not $apiRunning -and -not $webRunning) {
            Write-Host "Both local services have stopped." -ForegroundColor Yellow
            return
        }

        if (-not $apiRunning -or -not $webRunning) {
            $runtime = Get-RuntimeHealth -ApiBaseUrl $apiBaseUrl -TimeoutSec $config.ApiProbeTimeoutSec
            $session = Get-SessionHealth -ApiBaseUrl $apiBaseUrl -TimeoutSec $config.ApiProbeTimeoutSec
            $web = Get-WebHealth -WebBaseUrl $webBaseUrl -TimeoutSec $config.WebProbeTimeoutSec
            Write-StartupDiagnostics -Runtime $runtime -Session $session -Web $web -ApiPort $apiPort -WebPort $webPort -ApiHandle $script:ApiHandle -WebHandle $script:WebHandle
            Fail-Launcher -ExitCode 60 -Message "A local service exited unexpectedly."
        }
    }
}

try {
    Invoke-Launcher
    $script:LauncherExitCode = 0
}
catch {
    Write-Host ""
    Write-Host "Local launcher failed." -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host "Run .\check-local-app.cmd for detailed diagnostics." -ForegroundColor Yellow
}
finally {
    Stop-LoggedProcess -Handle $script:ApiHandle
    Stop-LoggedProcess -Handle $script:WebHandle
}

exit $script:LauncherExitCode
