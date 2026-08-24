# VELA Privacy

VELA is local-first. Conversations, plans, memory, settings, and generated media
stay on the user's computer by default.

## Data locations

- Small application databases and encrypted provider settings use the current
  Windows user's application-data directory.
- Models, caches, outputs, backups, and runtimes use the data directory selected
  by the user in Model Center.
- Uninstalling VELA does not delete user conversations, models, or generated
  media unless the user removes those directories separately.

## Network use

VELA uses the network only when the user configures a cloud provider, downloads
a model/runtime/update, performs an explicitly requested web action, or enables
a connector. Requests sent to a configured API are governed by that provider's
privacy policy. VELA has no advertising SDK and no default analytics telemetry.

## Diagnostics

Diagnostics remain local unless the user manually exports and shares them.
Exported diagnostics must remove secrets and may include version numbers,
component health, and redacted error messages.
