# Changelog

## Unreleased

## VELA 2.5.0-beta.7 — cross-platform release fix - 2026-08-25

- Keep the Windows desktop-control implementation importable and type-checkable on Linux and macOS release runners.
- Restore the complete Windows and macOS installer pipeline after the beta.6 quality job exposed the platform-specific typing issue.

## VELA 2.5.0-beta.6 — working plugins and desktop control - 2026-08-25

- Reconcile the running Agent process with the permission and plugin configuration instead of silently reusing stale capabilities.
- Make the Web Search plugin available to the model immediately after activation and verify it against live public search results.
- Add real Windows window discovery, exact-title activation, coordinate click, text input and safe control-key tools for Full Access mode.
- Terminate detached managed Agent process trees during capability reload so upgrades cannot leave an old server occupying the API port.
- Add a runtime capability endpoint and regression tests for enabled Web Search and desktop-control tools.

## VELA 2.5.0-beta.5 — permission, plugins and reliable image start - 2026-08-25

- Add Safe, Standard, and Full Access permission profiles that are enforced by the Agent runtime.
- Require an explicit risk acknowledgement before Full Access can be enabled, with one-click safe-mode revocation.
- Allow unrestricted commands and absolute local paths only while Full Access is active.
- Add a persistent plugin catalog with native, OAuth, configuration, and MCP connector entry points.
- Declare each plugin's requested permissions and never treat account connectors as authorized before login.
- Add desktop permission and plugin management surfaces plus regression coverage.
- Prevent local prompt translation from holding image generation indefinitely when an Ollama model is cold or unresponsive.
- Fall back to the original prompt after a hard six-second preparation deadline.
- Stop treating icon and interface design adjectives as unknown character identities requiring reference search.
- Verify the repaired native image path with a real 2560×1440 generation and output persistence.

## VELA 2.5.0-beta.4 — first public beta candidate - 2026-08-25

- Add first-launch hardware, memory, accelerator, network and model-drive detection with tiered recommendations.
- Add explicit offline, low-memory, no-accelerator and low-disk guidance.
- Make the Qwen3 4B direct starter path install llama.cpp, resume and verify the model, register it and activate it without Ollama.
- Retry interrupted catalog downloads up to three times while preserving valid partial data; remove corrupt partial files after SHA-256 failure.
- Add local crash diagnostics with secret redaction, privacy disclosure, user-data export, feedback entry and data-directory access.
- Label every generated image as the best returned candidate and state that character likeness is not guaranteed.
- Add clean Windows installation smoke testing and Windows/macOS release jobs for Intel and Apple Silicon.
- Add installation, privacy, known-issues and 20–50 person external beta-test documentation.

## VELA 2.4.5 — reliable character image delivery - 2026-08-25

- Recognize possessive character prompts such as “绊爱的正面图” as anime identity work instead of generic photography.
- Add built-in Kizuna AI identity traits and route known anime characters to the character image engine.
- Treat online reference discovery as an optional fidelity aid rather than a hard generation gate.
- Fall back to compiled identity traits when reference search is unavailable or returns no usable result.
- Stop rejecting completed images because of an advisory center-seam heuristic or a below-target identity score.
- Verified the exact prompt “绊爱的正面图” through the live VELA chat UI and received an image card backed by a valid local PNG.

## VELA 2.4.4 — always return the best generated image - 2026-08-25

- Fixed named buildings such as cathedrals being misclassified as unfamiliar characters.
- Limited identity scoring to actual character and reference-image work.
- Preserve and return the best structurally valid character result when identity confidence is below the preferred threshold.
- Keep strict split-panel rejection while avoiding empty failures caused only by an imperfect vision score.
- Show a concise refinement hint when the returned image would benefit from a user reference.
- Verified real Sophia Cathedral and Luo Tianyi generation through the desktop image backend.
- Fixed the center-seam heuristic falsely deleting ordinary centered portraits and buildings.
- Center-seam detection is now advisory and can no longer turn a completed image into an empty failure.

## VELA 2.4.3 — live image progress recovery - 2026-08-25

- Replaced fixed image percentages with monotonic, phase-aware estimated progress.
- Added backend phase timestamps and a renderer heartbeat so long model loads and sampling visibly advance.
- Added short status-request timeouts and overlap protection to prevent polling stalls.
- Added explicit progress states for quality retry, validation and upscaling.
- Versioned renderer modules so an installed upgrade cannot keep running stale cached progress code.
- Verified real generation, cancellation, invalid input and post-cancellation recovery.

## VELA 2.4.2 — resilient chat and liquid motion - 2026-08-25

- Recover stale local conversation identifiers automatically instead of returning a chat 500 error.
- Surface genuine network and image-generation failures and always clear pending UI state.
- Add a 15-minute hard client timeout to prevent image requests from loading forever.
- Remove a blocking Windows BITS pause from the image request path so installed builds start inference immediately.
- Skip expensive identity review for generic product, landscape, and concept images so completed outputs return immediately.
- Cap optional local prompt translation at 15 seconds and fall back safely when the chat model is cold.
- Replace blurred, bouncing reply motion with a restrained liquid-glass reveal.
- Keep thinking and image progress alive with localized lens motion instead of moving whole cards.
- Verify native generation, cancellation cleanup, post-cancel generation, and persisted D-drive output.

## VELA 2.4.1 — stable conversations and image fallback - 2026-08-25

- Update thinking text and image progress in place instead of rebuilding the complete conversation.
- Prevent historical messages from replaying entrance animations during refreshes.
- Normalize user and assistant message spacing and vertical alignment.
- Reconnect existing external-drive VELA image runtimes and make direct Diffusers inference the default path.
- Prevent generic image requests from triggering unnecessary character-reference research.
- Keep semantic review strict for identity-sensitive work without discarding valid generic images.
- Fall back to the installed ComfyUI backend when the independent image runtime is unavailable.
- Start preparing the independent image runtime automatically when no local image backend can run.

## VELA 2.4.0 — unified full-capability model center - 2026-08-25

- Expanded the local model catalog across general chat, agents, reasoning, coding, vision and embeddings.
- Added one-click installation and automatic activation for supported Ollama models.
- Added verified API onboarding for MiniMax M2.7, Gemini, Mistral, OpenRouter, DeepSeek and OpenAI-compatible services.
- Added configured-provider switching and capability filters in Model Center.
- Removed remaining public UI assumptions about fixed D:/E: model-library paths.

## VELA 2.3.2 — deterministic release packaging - 2026-08-24

- Disable Electron Builder's implicit tag publishing in CI.
- Keep GitHub release asset publication in one dedicated workflow step.

## VELA 2.3.1 — release pipeline repair - 2026-08-24

- Split desktop install, test, audit, and packaging into separately observable release steps.
- Build unsigned installers explicitly when no Windows signing certificate is configured.
- Preserve optional certificate signing support through GitHub repository secrets.

## VELA 2.3.0 — public-ready foundation - 2026-08-24

- Added first-run onboarding and a recovery-capable startup that remains usable while the Agent runtime is prepared.
- Replaced machine-specific model paths with a user-selectable data root and automatic legacy-library migration.
- Added managed uv/Python preparation so ordinary users do not need a development environment.
- Added one-click native image runtime preparation and verified downloads for Animagine, RealVisXL, and SSD-1B.
- Added resumable model downloads, cancellation, free-space checks, and SHA-256 validation where publishers provide hashes.
- Added NSIS installation, uninstall data retention, GitHub update metadata, and in-app update checks.
- Added public security, privacy, and clean-machine release documentation.
- Removed known production dependency vulnerabilities.

## VELA 2.2.0 — unified model library - 2026-08-24

- Rebuilt Model Center around clear Chat, Image, and API sections.
- Embedded discovery for Animagine XL, Juggernaut XL, SSD-1B, and FLUX.2 resources on D/E model drives.
- Added direct switching from an installed image model into VELA Image Studio.
- Added verified one-click external-drive installation for supported image checkpoints.
- Improved monochrome contrast, internal scrolling, status summaries, hover motion, and tab transitions.

## VELA 2.1.0 — direct local models and workspace UI - 2026-08-24

- Added a native GGUF runtime path powered by llama.cpp, fully bypassing Ollama.
- Added automatic GGUF discovery under the E:/D: model libraries and one-model-at-a-time memory control.
- Added one-click llama.cpp Vulkan runtime installation to `E:\\AI-Models\\Runtimes`.
- Split Tasks, Plans, Runs, Models, and Tools into clearer workspace views with useful empty-state actions.
- Expanded Model Center with direct-runtime status, direct model selection, and clearer backend choices.

## VELA 2.0.0 — independent agent release - 2026-08-24

- Removed the desktop runtime dependency on OpenClaw Gateway and its configuration.
- Added native VELA session APIs and persistent independent desktop conversations.
- Added a Model Center with one-click Ollama downloads and immediate model switching.
- Added DeepSeek, OpenAI-compatible and custom API provider forms with Windows-encrypted keys.
- Bundled the VELA Agent runtime into the Windows desktop distribution.
- Moved new runtime state to `.vela` and installed the desktop under the VELA product path.
- Added desktop and Start menu shortcuts plus a reproducible one-command installer.
- Verified the installed VELA 2.0 desktop against a real `qwen3:8b` conversation.

## VELA Agent 1.0 capability completion - 2026-08-24

- Completed structured failure reflection with persisted error context and recovery advice.
- Enforced bounded retry: one policy-approved timeout retry, with duplicate-error protection.
- Added versioned replanning candidates and approval-gated child plans that preserve the parent.
- Added true in-flight cancellation, consecutive-task isolation and restart recovery for plans.
- Added unfamiliar-character identity extraction, automatic reference search, local visual
  scoring, confidence-based selection, transient reference cleanup and stable fallback behavior.
- Added image-job leases so stale or cancelled jobs no longer block every later generation.
- Expanded automated coverage to the complete agent lifecycle and desktop image workflow.

## VELA 1.2.0 — life connectors - 2026-08-04

- Added a local Home Assistant connector for Xiaomi Home, Matter and other normalized smart-home entities.
- Added read-only entity discovery and state inspection plus governed service calls for approved home domains.
- Added official outbound Enterprise WeChat group-robot notifications with strict host validation.
- Added official QQ Bot v2 authentication and user/group text delivery using platform OpenIDs.
- Required single-use confirmation for every smart-home control and outgoing message.
- Kept personal WeChat login automation, simulated UI control and Huawei account scraping out of scope.
- Documented the Huawei Matter route and official partner-only cloud integration boundary.

## VELA Desktop 4.16.0 — reliable image completion - 2026-08-03

- Restored rendering for historical ComfyUI records persisted as relative `view?...` URLs when the underlying output still exists.
- Added deterministic desktop media URL tests for ComfyUI, local files and absolute web data.
- Kept local file media behind the authenticated, workspace-restricted desktop endpoint.
- Automatically routes explicit natural-language image requests to the local ComfyUI pipeline without requiring the Image button first.
- Persists direct image prompts together with their generated media so image conversations survive a desktop restart.
- Correctly ends the working state when OpenClaw returns histories in newest-first or oldest-first order.
- Prevents duplicate OCU API processes by probing the loopback port before running deep health checks or starting a server.
- Preserved the VELA 1.8 liquid-glass desktop experience while hardening image history.

## VELA 1.6.0 — liquid glass UI and image model studio - 2026-08-03

- Rebuilt the desktop layout around a stable grid so the workflow deck, chat stream, composer and workspace panel no longer cover each other.
- Added neutral black, graphite and ivory liquid-glass surfaces with animated ambient light, spring entrances, message transitions, panel expansion and hover feedback.
- Added compact subject presets for anime characters, reference-locked characters, realistic portraits, landscapes and product photography.
- Added image engine choices for Anime/Animagine XL, Fast SDXL, FLUX.2 reference and realistic Juggernaut XL routing.
- Added a realistic image route that selects the photography checkpoint when the user chooses the realistic engine.
- Bumped renderer cache keys and desktop package version to 4.12.0 so the installed desktop app cannot silently reuse the previous UI.

## VELA 1.5 UI refinement - 2026-08-03

- Reworked the desktop shell into a monochrome black, white and graphite glass system.
- Removed visible blue accents, animated scan effects and colorful status indicators.
- Replaced workspace glyphs with larger, restrained line icons and improved hit areas.
- Simplified the command deck, composer, image studio, status cards and session list.
- Preserved light and dark modes while keeping both themes within the same neutral visual language.

## VELA 1.5.0 - 2026-08-03

- Added a live local health badge for the OpenClaw Gateway, ComfyUI, Ollama and OCU services.
- Added memory-pressure and model-library resource diagnostics without loading any model.
- Added a real image-generation cancellation path that interrupts the active ComfyUI job, including 4K upscaling.
- Exposed image job phase and cancellation state through the local diagnostics and image-status APIs.
- Added an explicit VELA 1.5 release marker to the desktop title bar and bootstrap metadata.
- Rebuilt and deployed the portable desktop executable to the local OpenClaw app directory.

## 1.1.1 - 2026-07-30

- Refined VELA Desktop with a restrained black, white and graphite visual system.
- Replaced the previous colorful mark with a minimal monochrome VELA icon across the title bar, welcome screen, messages and desktop shortcut.
- Added spring-like entrance, message, control, dialog and toast animations with reduced-motion support.
- Fixed stale icon caching and restored the welcome screen scroll position when starting a new conversation.
- Rebuilt and installed VELA Desktop 4.1.1 after validating a real DeepSeek conversation.

## 1.1.0 - 2026-07-29

- Shipped VELA Desktop as a standalone Windows application instead of a browser launcher.
- Added a black, graphite and electric-blue interface with a new original VELA icon.
- Preserved existing OpenClaw sessions, Gateway authentication, tools, attachments and ComfyUI.
- Verified a real DeepSeek conversation through the packaged desktop executable.
- Added reproducible desktop source, build, install and launch automation.
- Retired the old OpenClaw executable and browser shortcuts after successful validation.

## 1.0.4 - 2026-07-29

- Reused the original OpenClaw Dashboard as VELA's primary local interface.
- Preserved the original OpenClaw icon, layout, sessions and runtime internals.
- Added an idempotent VELA branding layer with automatic local UI backups.
- Kept DeepSeek API as the primary chat model and Ollama as the local fallback.
- Updated the desktop launcher to open the authenticated OpenClaw Dashboard.

## 1.0.3 - 2026-07-29

- Fixed Windows-relative MCP configuration resolution that could make local chat return HTTP 500.
- Reused API stores and the chat agent to avoid repeated SQLite initialization and UI lock waits.
- Added an original AI-generated VELA avatar and a black, graphite and electric-blue local UI.
- Improved chat progress, local-only status, structured errors and one-click retry.

## 1.0.2 - 2026-07-29

- Limited GitHub Release uploads to the VELA wheel and source archive.

## 1.0.1 - 2026-07-29

- Fixed the governed shell runner's Windows creation flag lookup so Linux type
  checking and release CI remain portable.

## 1.0.0 - 2026-07-29

- Rebranded the local agent as VELA while preserving OCU compatibility.
- Added the local Command Deck UI and expanded v1 API.
- Added persisted confirmations, audit events, database migrations and plan controls.
- Added governed memory metadata, expiration and archival.
- Added PDF, DOCX, HTML, CSV, JSON and source-code knowledge extraction.
- Enabled and verified the bundled read-only `vela-local` MCP server.
- Added Windows desktop installation, backup, integrity and release tooling.
- Added Windows/Linux CI and tagged release packaging.

## 0.1.0 - 2026-07-29

### Added

- Async Agent Runtime with bounded tool loops.
- Persistent sessions, rolling summaries and semantic memory.
- Structured Planner, DAG Executor, Reflection, bounded retry and plan revisions.
- Bidirectional OpenClaw plugin and CLI integration.
- Deterministic OpenClaw Browser reads.
- Shared OpenClaw ComfyUI workflow integration with real image generation.
- Hardware-aware Ollama model inventory and task routing.
- Allowlisted MCP stdio client.
- Incremental local knowledge indexing, hybrid retrieval and line citations.
- Loopback-only local JSON API and unified diagnostics.
- Repeatable bootstrap, OpenClaw integration, start, stop and verification scripts.

### Security

- OpenClaw Gateway credentials remain owned by OpenClaw.
- Workspace file tools enforce root boundaries.
- Shell remains disabled by default and uses a command allowlist when enabled.
- MCP servers are opt-in and loaded only from a local command allowlist.
- ComfyUI generation uses one preconfigured workflow rather than arbitrary workflow paths.
- The local API rejects non-loopback binding unless explicitly enabled.
