param(
    [string]$ProjectRoot = (Split-Path -Parent $PSScriptRoot)
)

$ErrorActionPreference = "Stop"

$resolvedRoot = (Resolve-Path -LiteralPath $ProjectRoot).Path
$executable = Join-Path $env:LOCALAPPDATA "Programs\VELA\VELA.exe"

if (-not (Test-Path -LiteralPath $executable -PathType Leaf)) {
    & (Join-Path $PSScriptRoot "install_vela.ps1") -ProjectRoot $resolvedRoot
}

Start-Process -FilePath $executable -WorkingDirectory (Split-Path -Parent $executable)
Write-Host "[OK] Native VELA desktop started."
