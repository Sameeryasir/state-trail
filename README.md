# StateTrail — React action debugging toolkit

> **Status: prototype / v0.1.0, not published on npm.** Package names and npm scopes in this repository are placeholders; confirm availability and ownership before publishing.

StateTrail helps you answer: **“What happened between the user's click and the unexpected result?”**

It is a reusable **TypeScript library** plus an optional **React debugging panel**. The developer explicitly wraps an operation in `traceAction()`. Related `fetch()` calls made through the provided action context appear alongside action start, success, failure, and optional notes. Each event has an `actionId` so you can see a complete timeline.

## What it solves

Without an action timeline, debugging a failed save might involve switching among event handlers, browser Network, and console logs. StateTrail consolidates **instrumented** events into a local, bounded in-memory timeline:

```
save-profile                action:start
Form validation passed     note
GET /invalid-route         request:start
GET /invalid-route (404)   request:error
save-profile               action:error
```

**What it does NOT do:** Automatically inspect React's internal state, automatically catch every request, correlate backend server errors, repair bugs, or prove root causes. HTTP error responses are recorded as request errors but `fetch()` itself only rejects on network failure; your application must check `response.ok` and throw when appropriate.

## Architecture

```
statetrail/
├── packages/
│   ├── core/           @statetrail/core: action tracing, fetch wrapper, event store
│   └── react/          @statetrail/react: useTrailEvents + StateTrailPanel
├── examples/
│   └── demo/           React + Vite demonstration
├── .github/workflows/ci.yml
├── CONTRIBUTING.md
└── LICENSE
```

### How it works

1. `createTrail()` creates a bounded local event store.
2. `traceAction('save-profile', async ({fetch, note}) => ...)` creates an action ID and a start event.
3. `note()` optionally records safe, developer-authored milestone labels.
4. The **context's** `fetch()` records request method, path, HTTP status, and duration under the same action ID.
5. Completing or throwing records a success or error event. Exceptions are **re-thrown**, not silently swallowed.
6. The optional React panel uses `useSyncExternalStore` to stay up to date.

## Requirements

- Node.js 20+ and npm 9+
- React 18+ for the optional UI panel
- An internet connection to demonstrate the deliberately failing HTTP request; the successful action works offline

## Run locally

```bash
# From the repository root
npm install
npm run build
npm test
npm run typecheck
npm run dev
```

Visit **http://localhost:5173** and click **Simulate failed save**. Inspect the timeline below the form. Then try the successful action. The failing request uses a public demo URL; a network error will also appear if offline.

## Library usage

Use workspaces when developing in this repo. Once you publish to an npm scope you own, consumers would install packages with commands like:

```bash
npm install @your-scope/core @your-scope/react
```

Sample code (replace imports with the actual published package names):

```tsx
import { createTrail } from '@statetrail/core';
import { StateTrailPanel } from '@statetrail/react';

const trail = createTrail({ maxEvents: 200, enabled: import.meta.env.DEV });

async function saveProfile() {
  await trail.traceAction('save-profile', async ({ fetch, note }) => {
    note('validation passed');
    const response = await fetch('/api/profile', { method: 'PUT' });
    if (!response.ok) throw new Error(`Profile save failed: ${response.status}`);
  });
}

// Render in your React tree: <StateTrailPanel trail={trail} />
```

`traceAction()` returns a Promise and preserves the callback's result or error. For Node.js/non-React use, import only the core package; Node's built-in `fetch` is supported on Node 20+.

## Core API

| API | Purpose |
| --- | --- |
| `createTrail({ enabled, maxEvents })` | Create isolated bounded event store |
| `trail.traceAction(name, fn)` | Record operation start/end/error |
| `context.fetch(input, init)` | Record an explicit fetch request for that action |
| `context.note(label)` | Add an explicit milestone |
| `trail.getSnapshot()` | Read immutable event array snapshot |
| `trail.subscribe(listener)` | Subscribe to changes; returns unsubscribe |
| `trail.groupByAction()` | Fold events into per-action trails |
| `trail.exportReport()` | Sanitized JSON bug-report snapshot |
| `trail.clear()` | Reset recorded events |
| `<StateTrailPanel trail={trail} />` | Trail map UI (group / flat / export) |

## Privacy and security

- Default data lives **only in the current process or browser memory**; there is no server, analytics upload, or persistent storage.
- Network instrumentation is **explicit**, not a global monkey-patch.
- Captured URLs are restricted to the **pathname** (query strings, hostname, and URL userinfo are excluded).
- By default, StateTrail does **not** capture request/response bodies, headers, cookies, or tokens.
- **Important:** URL *path segments*, explicitly authored action names, notes, and error messages **can still contain sensitive information**. Do not pass passwords, identifying IDs, or unredacted API errors into tracing. The library is intended for local development; it is **not an audited security or compliance solution**.
- Disable in production: `enabled: import.meta.env.DEV` (Vite) or an equivalent environment check. The React panel should also be excluded from production builds.
- Keep captured event counts bounded with `maxEvents`.

## Testing

```bash
npm run build
npm test
npm run typecheck
```

The tests cover successful action correlation, error propagation, bounded event storage, disabled tracing, and HTTP status/redaction of query parameters.

## Publish to npm (after you're happy with the implementation)

1. Create an npm account and choose an **available scope/package name**. You cannot publish `@statetrail/*` unless you own that scope.
2. Replace the package names in `packages/core/package.json`, `packages/react/package.json`, all imports, dependencies, and references. If using your personal scope, use `@YOUR_NPM_USERNAME/core` and `@YOUR_NPM_USERNAME/react`, or a more descriptive naming scheme.
3. Update versions and dependency references consistently.
4. Run build, tests, typecheck, and inspect package payloads (`npm pack --dry-run -w <workspace>`).
5. Log in with `npm login` and enable required npm account security measures.
6. Publish **core first**, then **react**, e.g. `npm publish -w @your-scope/core --access public`, followed by `npm publish -w @your-scope/react --access public`.
7. For CI releases, prefer npm trusted publishing with GitHub Actions rather than long-lived npm tokens.

**Do not publish this prototype without reviewing its behavior, package ownership, and security posture.**

## Roadmap

- [x] Core action-tracing API
- [x] Opt-in fetch instrumentation
- [x] Bounded event timeline
- [x] React developer panel
- [x] Small test suite and CI template
- [x] Local action grouping and expandable event detail
- [x] Export sanitized bug report JSON
- [ ] Optional Axios integration
- [ ] Optional state-transition adapter (for Zustand or Redux)
- [ ] Optional backend request correlation
- [ ] Performance benchmarks / broader test coverage

## License

MIT. Contributions welcome; see [CONTRIBUTING.md](./CONTRIBUTING.md).
