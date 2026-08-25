# VELA Privacy Notice

VELA is local-first. Public beta builds do not enable product analytics, advertising telemetry or automatic diagnostic uploads.

## Stored locally

- conversations and sessions;
- plans, execution state and memory;
- selected model and storage configuration;
- generated outputs and downloaded local models;
- crash reports containing application version, platform, stack trace and sanitized error context.

API keys are encrypted using the operating system's secure storage when available. Keys, passwords, authorization headers and tokens are redacted from diagnostic records. If secure storage is unavailable, VELA refuses to save the key.

## Network access

VELA connects externally only when required for an action you initiate: downloading a model or update, calling an API provider you configured, or searching for visual references during identity-sensitive image generation. Reference images are temporary and removed after the generation workflow.

Diagnostics remain on the device until the user deliberately exports or shares them. Data export excludes API keys, downloaded models and temporary caches.

## Uninstalling

The application installer and user data/model directories are separate. This prevents uninstalling the app from unexpectedly deleting multi-gigabyte models. Before uninstalling, use **Support → Export my data**. To remove everything, uninstall VELA and then delete the data directory shown in **Support → Open data directory**.
