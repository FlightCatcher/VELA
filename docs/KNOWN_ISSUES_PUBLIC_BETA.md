# VELA Public Beta — Known Issues

- The first macOS beta may be unsigned and not notarized. Official notarization is required before a stable public release.
- Intel Mac local inference is substantially slower than Apple Silicon or NVIDIA CUDA hardware.
- Image-model installation is large and can take a long time. Low-memory systems should close other GPU applications first.
- Character generation returns the best valid candidate, but likeness is not guaranteed. Providing a lawful reference image generally improves consistency.
- The direct Qwen3 4B starter model is intended for installation simplicity, not maximum reasoning quality.
- Paused downloads resume only while the source server supports HTTP Range requests. If the source changes its file, checksum verification removes the invalid partial file and restarts cleanly.
- API-provider availability and pricing are controlled by the provider, not VELA.

Report reproducible problems through the **Support → Issue feedback** button. Include VELA version, operating system, hardware summary, exact steps and the exported diagnostic file when comfortable sharing it.
