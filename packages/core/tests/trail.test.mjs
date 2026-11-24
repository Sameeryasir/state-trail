import test from 'node:test';
import assert from 'node:assert/strict';
import { createTrail } from '../dist/index.js';

test('traceAction emits a correlated start and success', async () => {
  const trail = createTrail();
  const value = await trail.traceAction('save', async ({ note }) => { note('validated'); return 42; });
  assert.equal(value, 42);
  assert.deepEqual(trail.getSnapshot().map(x => x.kind), ['action:start','note','action:success']);
  assert.equal(new Set(trail.getSnapshot().map(x => x.actionId)).size, 1);
});

test('traceAction preserves errors and records failure', async () => {
  const trail = createTrail();
  await assert.rejects(trail.traceAction('save', () => { throw new Error('Oops'); }), /Oops/);
  assert.equal(trail.getSnapshot().at(-1).kind, 'action:error');
});

test('events are capped and clear triggers subscriber', () => {
  const trail = createTrail({ maxEvents: 2 });
  let updates = 0;
  const unsub = trail.subscribe(() => updates++);
  trail.note('a'); trail.note('b'); trail.note('c');
  assert.equal(trail.getSnapshot().length, 2);
  trail.clear(); unsub(); trail.note('d');
  assert.equal(updates, 4);
});

test('disabled trail does not persist events', async () => {
  const trail = createTrail({ enabled:false });
  assert.equal(await trail.traceAction('a', () => 7), 7);
  assert.equal(trail.getSnapshot().length, 0);
});

test('request errors carry status while query strings are excluded', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response('fail', { status: 500 });
  try {
    const trail = createTrail();
    await trail.traceAction('load', ({ fetch }) => fetch('https://service.test/api/users?token=secret'));
    const request = trail.getSnapshot().find(x=>x.kind==='request:error');
    assert.equal(request.status, 500);
    assert.equal(request.name, 'GET /api/users');
    assert.equal(JSON.stringify(trail.getSnapshot()).includes('secret'), false);
  } finally { globalThis.fetch = originalFetch; }
});

test('groupByAction correlates notes and requests under one action', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response('ok', { status: 200 });
  try {
    const trail = createTrail();
    await trail.traceAction('save', async ({ fetch, note }) => {
      note('ready');
      await fetch('https://service.test/api');
    });
    const groups = trail.groupByAction();
    assert.equal(groups.length, 1);
    assert.equal(groups[0].name, 'save');
    assert.equal(groups[0].outcome, 'success');
    assert.equal(groups[0].noteCount, 1);
    assert.ok(groups[0].requestCount >= 2); // request:start + request:success
  } finally { globalThis.fetch = originalFetch; }
});

test('exportReport returns a versioned sanitized snapshot', async () => {
  const trail = createTrail();
  await trail.traceAction('ping', ({ note }) => { note('ok'); });
  const report = trail.exportReport();
  assert.equal(report.version, 1);
  assert.equal(report.actionCount, 1);
  assert.ok(report.generatedAt);
  assert.equal(report.actions[0].outcome, 'success');
});
