# VELA Public Beta — Installation and Quick Start

## Windows 10/11

1. Download `VELA-Setup-<version>.exe` from the GitHub release page.
2. Run the installer and choose an installation directory.
3. On first launch, choose a data directory with at least 12 GB free space. Model files, cache and generated images are stored there rather than being forced onto the system drive.
4. VELA checks memory, graphics hardware and model-drive capacity, then shows a suitable local model or API recommendation.
5. For the simplest private setup, choose **Qwen3 4B Q4 (direct)**. VELA downloads its own llama.cpp runtime and model; Python and Ollama are not prerequisites.

The download can resume from its `.part` file. VELA checks free space before downloading and verifies catalog assets with SHA-256 before activation.

## macOS public beta

GitHub releases provide separate Apple Silicon (`arm64`) and Intel (`x64`) DMG/ZIP files. The first beta is unsigned unless the project has Apple Developer signing and notarization secrets configured. On an unsigned beta, macOS may require **Privacy & Security → Open Anyway**. Do not bypass warnings for packages downloaded anywhere except the official VELA GitHub release.

Apple Silicon uses the native Metal-capable local runtime. Intel Macs can run the CPU build but should prefer smaller 4B models or cloud APIs.

## First five minutes

- Open **Model Center** and install one recommended chat model.
- Send a short message and confirm that the selected model responds.
- Open **Support** to review the detected hardware, privacy behavior and local diagnostic status.
- Image generation is optional and much larger. Install an image model only when enough disk and memory are available.
- Generated character images are labeled **Best result returned**. Identity fidelity depends on the model and available references and is never guaranteed.

## Offline use

Installed direct models continue to work offline. New model downloads, cloud APIs, application updates and online reference search require a network connection. VELA displays an explicit offline warning rather than repeatedly retrying in the background.
