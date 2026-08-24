param(
    [ValidateSet("Start", "Status", "Complete", "Verify")]
    [string]$Action = "Status"
)

$ErrorActionPreference = "Stop"
$root = "E:\OpenClaw-Knowledge"
$zimRoot = Join-Path $root "library\zim"
$checksumRoot = Join-Path $root "manifests\checksums"
$items = @(
    @{
        Job = "VELA-Knowledge-ZH-Wikipedia-2026-05"
        File = "wikipedia_zh_all_maxi_2026-05.zim"
        Url = "https://download.kiwix.org/zim/wikipedia/wikipedia_zh_all_maxi_2026-05.zim"
    },
    @{
        Job = "VELA-Knowledge-SimpleEN-Wikipedia-2026-06"
        File = "wikipedia_en-simple_all_maxi_2026-06.zim"
        Url = "https://download.kiwix.org/zim/wikipedia/wikipedia_en-simple_all_maxi_2026-06.zim"
    }
)

New-Item -ItemType Directory -Force -Path $zimRoot, $checksumRoot | Out-Null

function Write-KnowledgeLog {
    param([string]$Message)
    $log = Join-Path $root "logs\knowledge-update.log"
    New-Item -ItemType Directory -Force -Path (Split-Path $log) | Out-Null
    "$(Get-Date -Format o) $Message" | Add-Content -LiteralPath $log -Encoding utf8
}

if ($Action -eq "Start") {
    foreach ($item in $items) {
        $existing = Get-BitsTransfer -ErrorAction SilentlyContinue |
            Where-Object DisplayName -eq $item.Job
        $target = Join-Path $zimRoot $item.File
        if (-not $existing -and -not (Test-Path -LiteralPath $target)) {
            Start-BitsTransfer -Source $item.Url -Destination $target `
                -DisplayName $item.Job -Asynchronous -Priority Normal
        }
    }
}

if ($Action -eq "Complete") {
    Get-BitsTransfer -ErrorAction SilentlyContinue |
        Where-Object {
            $_.DisplayName -like "VELA-Knowledge-*" -and
            $_.JobState -in @("TransientError", "Suspended")
        } |
        ForEach-Object {
            try {
                $_ | Resume-BitsTransfer -Asynchronous -ErrorAction Stop
                Write-KnowledgeLog "Resumed $($_.DisplayName)."
            }
            catch {
                Write-KnowledgeLog "Resume skipped for $($_.DisplayName): $($_.Exception.Message)"
            }
        }
    $completed = @(
        Get-BitsTransfer -ErrorAction SilentlyContinue |
            Where-Object { $_.DisplayName -like "VELA-Knowledge-*" -and $_.JobState -eq "Transferred" }
    )
    $completed | ForEach-Object {
        try {
            $_ | Complete-BitsTransfer -ErrorAction Stop
            Write-KnowledgeLog "Completed $($_.DisplayName)."
        }
        catch {
            Write-KnowledgeLog "Completion failed for $($_.DisplayName): $($_.Exception.Message)"
        }
    }
    if ($completed.Count -gt 0) {
        $exe = "E:\OpenClaw-Knowledge\tools\kiwix-tools-2026-07-16\kiwix-serve.exe"
        $archives = Get-ChildItem -LiteralPath $zimRoot -Filter "*.zim" -File
        $arguments = @("--port=18080", "--address=127.0.0.1") +
            @($archives.FullName | ForEach-Object { '"' + $_ + '"' })
        Stop-ScheduledTask -TaskName "VELA Offline Knowledge" -ErrorAction SilentlyContinue
        $taskAction = New-ScheduledTaskAction -Execute $exe -Argument ($arguments -join " ")
        $trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
        $taskSettings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries `
            -DontStopIfGoingOnBatteries -ExecutionTimeLimit ([TimeSpan]::Zero) `
            -MultipleInstances IgnoreNew
        Register-ScheduledTask -TaskName "VELA Offline Knowledge" -Action $taskAction `
            -Trigger $trigger -Settings $taskSettings -Force | Out-Null
        Start-ScheduledTask -TaskName "VELA Offline Knowledge"
    }
}

if ($Action -in @("Start", "Status", "Complete")) {
    Get-BitsTransfer -ErrorAction SilentlyContinue |
        Where-Object DisplayName -like "VELA-Knowledge-*" |
        Select-Object DisplayName, JobState, BytesTransferred, BytesTotal, ErrorDescription
}

if ($Action -eq "Verify") {
    foreach ($item in $items) {
        $target = Join-Path $zimRoot $item.File
        $checksum = Join-Path $checksumRoot ($item.File + ".sha256")
        if (-not (Test-Path -LiteralPath $target)) {
            Write-Warning "Missing: $target"
            continue
        }
        $expected = ((Get-Content -LiteralPath $checksum -Raw).Trim() -split "\s+")[0].ToUpperInvariant()
        $actual = (Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash
        [pscustomobject]@{
            File = $item.File
            Valid = $actual -eq $expected
            Expected = $expected
            Actual = $actual
        }
    }
}
