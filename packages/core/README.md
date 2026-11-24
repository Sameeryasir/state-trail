# @statetrail/core

Opt-in action + fetch tracing for local development.

## What it does

- `createTrail()` — bounded in-memory event store
- `traceAction(name, fn)` — correlate start / notes / requests / success|error
- `groupByAction()` — fold flat events into per-action trails
- `exportReport()` — sanitized JSON for bug tickets (no bodies, headers, or query strings)

See the root README for privacy limits and the React panel.
