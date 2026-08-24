param(
    [string]$ProjectRoot = (Split-Path -Parent $PSScriptRoot),
    [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"
$resolvedRoot = (Resolve-Path -LiteralPath $ProjectRoot).Path
$sourceRoot = Join-Path $resolvedRoot "integrations\vela-desktop"
$unpackedRoot = Join-Path $sourceRoot "dist\win-unpacked"
$builtExecutable = Join-Path $unpackedRoot "VELA.exe"
$appRoot = Join-Path $env:LOCALAPPDATA "Programs\VELA"
$executable = Join-Path $appRoot "VELA.exe"
$iconPath = Join-Path $appRoot "vela-icon.ico"
$desktopShortcut = Join-Path ([Environment]::GetFolderPath("Desktop")) "VELA.lnk"
$startMenuShortcut = Join-Path ([Environment]::GetFolderPath("Programs")) "VELA.lnk"

if (-not (Test-Path -LiteralPath (Join-Path $sourceRoot "package.json") -PathType Leaf)) {
    throw "VELA desktop source is missing: $sourceRoot"
}

if (-not $SkipBuild) {
    Push-Location $sourceRoot
    try {
        & npm ci
        if ($LASTEXITCODE -ne 0) { throw "VELA dependencies could not be installed." }
        & npm run test
        if ($LASTEXITCODE -ne 0) { throw "VELA desktop tests failed." }
        & npm run build
        if ($LASTEXITCODE -ne 0) { throw "VELA desktop build failed." }
    }
    finally { Pop-Location }
}

if (-not (Test-Path -LiteralPath $builtExecutable -PathType Leaf)) {
    throw "VELA desktop executable is missing: $builtExecutable"
}

New-Item -ItemType Directory -Force -Path $appRoot | Out-Null
Copy-Item -Path (Join-Path $unpackedRoot "*") -Destination $appRoot -Recurse -Force
Copy-Item -LiteralPath (Join-Path $sourceRoot "build\vela-icon.ico") -Destination $iconPath -Force

$shell = New-Object -ComObject WScript.Shell
foreach ($shortcutPath in @($desktopShortcut, $startMenuShortcut)) {
    $shortcut = $shell.CreateShortcut($shortcutPath)
    $shortcut.TargetPath = $executable
    $shortcut.WorkingDirectory = $appRoot
    $shortcut.IconLocation = "$iconPath,0"
    $shortcut.Description = "VELA independent AI agent"
    $shortcut.Save()
}

if ($shell.CreateShortcut($desktopShortcut).TargetPath -ne $executable) {
    throw "VELA desktop shortcut verification failed."
}

Write-Host "[OK] VELA installed: $executable"
Write-Host "[OK] Desktop shortcut: $desktopShortcut"
Write-Host "[OK] Start menu shortcut: $startMenuShortcut"
