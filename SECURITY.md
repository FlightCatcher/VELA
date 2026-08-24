# VELA Security Policy

## Supported versions

Security fixes are provided for the latest stable VELA release. Preview builds
are supported on a best-effort basis and should not be used for unattended
high-risk automation.

## Reporting a vulnerability

Do not publish credentials, exploit details, or private user data in a public
issue. Use GitHub's private vulnerability reporting for this repository. Include
the VELA version, Windows version, reproduction steps, impact, and relevant
redacted logs.

## Security boundaries

- VELA listens only on loopback interfaces and authenticates desktop requests.
- API credentials are encrypted with Windows safe storage and are not committed.
- Local files are not uploaded unless a user explicitly chooses a remote model
  for a task that requires their content.
- Destructive tools, system changes, external messages, and purchases require
  explicit confirmation.
- Model and runtime downloads use HTTPS; checkpoints with published hashes are
  verified before activation.
- Logs must redact API keys, access tokens, cookies, and authorization headers.

## User responsibilities

Revoke any token that has been pasted into a chat, issue, or log. Keep Windows
and GPU drivers updated, install VELA only from this repository's Releases page,
and review the requested tool action before confirming it.
