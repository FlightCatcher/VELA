# Public release checklist

1. Run Python lint, type checks, and tests.
2. Run desktop tests and production dependency audit.
3. Build both `VELA-Setup-<version>.exe` and `VELA-Desktop.exe`.
4. Test installation in a clean Windows 11 virtual machine.
5. Test first launch without Python, Node.js, uv, Ollama, or existing models.
6. Select a non-system model drive and verify all paths follow it.
7. Interrupt and resume a model download; verify its published SHA-256.
8. Test local GGUF, an API provider, image generation, cancellation, restart
   recovery, upgrade, and uninstall while retaining user data.
9. Run a secret scan and inspect release contents.
10. Sign executables when a Windows code-signing certificate is configured.
11. Push a version tag only after all blocking checks pass.
