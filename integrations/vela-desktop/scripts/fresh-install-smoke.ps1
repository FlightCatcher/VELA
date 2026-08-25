$ErrorActionPreference = "Stop"

$installer = Get-ChildItem -LiteralPath "$PSScriptRoot\..\dist" -Filter "VELA-Setup-*.exe" |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1
if (-not $installer) { throw "VELA installer was not produced." }

$installRoot = Join-Path $env:LOCALAPPDATA "Programs\VELA"
$executable = Join-Path $installRoot "VELA.exe"
Start-Process -FilePath $installer.FullName -ArgumentList "/S" -Wait -WindowStyle Hidden
if (-not (Test-Path -LiteralPath $executable)) { throw "VELA executable was not installed." }

$process = Start-Process -FilePath $executable -PassThru
Start-Sleep -Seconds 20
if ($process.HasExited) { throw "VELA exited during first-launch smoke testing with code $($process.ExitCode)." }
$version = (Get-Item -LiteralPath $executable).VersionInfo.ProductVersion
if (-not $version) { throw "Installed VELA has no product version." }
Stop-Process -Id $process.Id -Force
Write-Host "Fresh-install smoke test passed for VELA $version"
