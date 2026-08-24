# VELA Agent 1.0 capability baseline

This document defines the acceptance baseline for the first complete local-agent loop. It is
independent of the desktop package's historical version number.

## Agent loop

VELA 1.0 accepts a goal, persists a DAG plan, executes ready steps in dependency order, calls
the configured model and governed tools, records results, reflects on failures, permits one
policy-approved retry, and can prepare a versioned replacement plan for explicit approval.

The original failed plan is immutable. Replanning creates a candidate revision and applying it
creates a new child plan linked to its parent. VELA never retries permission failures, never
loops indefinitely, and never applies a revision without approval.

## Recovery guarantees

- Consecutive plans do not share execution state.
- Cancelling an in-flight step cancels its model task and persists a cancelled plan.
- A process restart changes interrupted running plans to paused and resets running steps to
  pending with an interruption marker.
- The original exception and reflection record remain available for diagnosis.
- Image jobs carry a lease; cancelled, legacy, or expired jobs are reclaimed before accepting a
  new request.

## Identity-aware image generation

For named or unfamiliar characters, VELA extracts a stable identity label, searches for visual
references, evaluates candidates with the local vision model, and selects only references above
an explicit confidence threshold. Verified references may enter local character memory; weak
references are used only as transient guidance. If no dependable reference is available, native
generation falls back to a constrained text specification and reports that fallback instead of
pretending identity was verified. Strict reference mode fails clearly rather than generating an
unrelated identity.

Temporary downloaded references are deleted after each job. User references and configured
curated references are not deleted.

## Automated acceptance

The release is accepted only when all of these pass:

```powershell
uv sync --dev
uv run ruff check .
uv run mypy src
uv run pytest -q
Set-Location integrations/vela-desktop
npm test
npm run build
```

The Python suite covers DAG execution, persistence, Reflection, bounded retry, versioned
replanning, cancellation, exception preservation, consecutive tasks, and restart recovery. The
desktop suite covers request routing, identity extraction, reference scoring, media rendering,
cancelled callback rejection, and stale image-job recovery.

## Deliberate limits

- Reflection advises; it does not invoke tools.
- Retry is bounded and policy driven.
- Replanning requires explicit approval.
- Shell and external side effects remain governed.
- Visual identity confidence is an engineering score, not a promise of exact copyrighted
  character reproduction.
