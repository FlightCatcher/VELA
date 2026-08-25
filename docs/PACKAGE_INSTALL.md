# Install VELA with a package manager

## Windows — Scoop

```powershell
scoop bucket add vela https://github.com/FlightCatcher/scoop-vela
scoop install vela
```

Upgrade later with `scoop update vela`.

## Windows — WinGet

The WinGet manifest is ready under `packages/winget`. Its first submission must
pass Microsoft's automated checks and moderator review before this command works:

```powershell
winget install --id FlightCatcher.VELA --exact
```

## macOS — Homebrew

```bash
brew tap FlightCatcher/vela
brew install --cask vela
```

Upgrade later with `brew upgrade --cask vela`.

The current public beta is not Apple-notarized. macOS may require explicit
approval under **System Settings → Privacy & Security** on first launch.

## Integrity and first-run behavior

Every manifest pins the SHA-256 digest of its GitHub Release asset. Installing
VELA does not silently download Python or an AI model. Model recommendations and
downloads happen only after the first-run hardware check and user selection.
