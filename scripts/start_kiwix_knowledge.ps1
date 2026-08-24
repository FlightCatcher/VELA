$ErrorActionPreference = "Stop"

$exe = "E:\OpenClaw-Knowledge\tools\kiwix-tools-2026-07-16\kiwix-serve.exe"
$zimRoot = "E:\OpenClaw-Knowledge\library\zim"
$logs = "E:\OpenClaw-Knowledge\logs"
$archives = Get-ChildItem -LiteralPath $zimRoot -Filter "*.zim" -File

if (-not (Test-Path -LiteralPath $exe)) {
    throw "Kiwix server is not installed: $exe"
}
if (-not $archives) {
    throw "No completed ZIM archives were found in $zimRoot"
}

New-Item -ItemType Directory -Force -Path $logs | Out-Null
$arguments = @("--port=18080", "--address=127.0.0.1") + $archives.FullName
Start-Process -FilePath $exe -ArgumentList $arguments -WindowStyle Hidden `
    -RedirectStandardOutput (Join-Path $logs "kiwix.out.log") `
    -RedirectStandardError (Join-Path $logs "kiwix.err.log")
