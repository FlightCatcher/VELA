# VELA Desktop

VELA Desktop is the independent Windows and macOS interface for VELA. It bundles the
Agent source and prepares a managed runtime on first launch, so Python, Node.js, Ollama
and preinstalled models are not prerequisites for the direct-model starter path.

## Development

```powershell
npm ci
npm start
```

## Build

Windows: `npm run build:win`

macOS: `npm run build:mac`

Windows installers and macOS DMG/ZIP packages are written to `dist/`.

Do not commit `node_modules/` or `dist/`.
