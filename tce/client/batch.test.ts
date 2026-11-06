import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { LIMITS } from '../core/schema/limits.ts';
import type { ErrorWire, EventWire, SessionWire } from '../core/schema/wire.ts';
import { planBatches, toRequest, type Envelope, type PlanInput } from './batch.ts';
import { jsonBytes } from './sanitize.ts';

const ENV: Envelope = {
  identity: { installId: '00000000-0000-4000-8000-000000000001', deviceId: 'a'.repeat(64), hwHash: 'b'.repeat(64), deviceVerifier: '9'.repeat(64) },
  device: {
    manufacturer: 'Google',
    model: 'Pixel 9',
    sdkInt: 36,
    abi: 'arm64-v8a',
    ramGb: 12,
    locale: 'en-IN',
    installSource: null,
    tester: false,
  },
  app: { version: '0.1.3', versionCode: 13, channel: 'full' },
};

function session(id: string): SessionWire {
  return { sessionId: id, startedAt: 1, counters: { 'tool.mobile_click': 3 } };
}

function events(n: number, sessionId = 's1', props?: EventWire['props']): EventWire[] {
  return Array.from({ length: n }, (_, i) => ({ sessionId, seq: i + 1, ts: 1000 + i, name: 'chat.open', ...(props ? { props } : {}) }));
}

function errors(n: number, sessionId: string | null = 's1'): ErrorWire[] {
  return Array.from({ length: n }, (_, i) => ({
    errorId: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
    sessionId,
    seq: sessionId ? 10_000 + i : null,
    ts: 1,
    kind: 'js' as const,
    className: 'TypeError',
    message: 'x is undefined',
    frames: ['at a (index.bundle:1:2)'],
  }));
}

function input(partial: Partial<PlanInput>): PlanInput {
  return {
    sessions: new Map([['s1', session('s1')]]),
    dirty: [],
    events: [],
    errors: [],
    ...partial,
  };
}

describe('planBatches', () => {
  it('splits by the events-per-batch cap and repeats the session upsert', () => {
    const n = LIMITS.eventsPerBatch;
    const { plans, oversized } = planBatches(ENV, input({ events: events(2 * n + 50) }));
    assert.equal(oversized.length, 0);
    assert.deepEqual(plans.map((p) => p.events.length), [n, n, 50]);
    for (const p of plans) assert.deepEqual(p.sessions.map((s) => s.sessionId), ['s1']);
  });

  it('splits by the errors-per-batch cap and puts errors first', () => {
    const n = LIMITS.errorsPerBatch;
    const { plans } = planBatches(ENV, input({ errors: errors(2 * n + 5), events: events(10) }));
    assert.deepEqual(plans.map((p) => p.errors.length), [n, n, 5]);
    assert.equal(plans[2]!.events.length, 10);
  });

  it('splits by body bytes, keeps every item exactly once and in order', () => {
    const props = { a: 'x'.repeat(200), b: 'y'.repeat(200) };
    const all = events(800, 's1', props);
    const { plans, oversized } = planBatches(ENV, input({ events: all }));
    assert.equal(oversized.length, 0);
    assert.ok(plans.length > 1);
    for (const [i, p] of plans.entries()) {
      const size = jsonBytes(toRequest(ENV, p, '00000000-0000-4000-8000-00000000abcd', Date.now()));
      assert.ok(size <= LIMITS.batchBodyBytes, `plan ${i} is ${size} bytes`);
    }
    assert.deepEqual(plans.flatMap((p) => p.events), all);
  });

  it('respects the sessions-per-batch cap', () => {
    const sessions = new Map<string, SessionWire>();
    const evs: EventWire[] = [];
    const n = LIMITS.sessionsPerBatch;
    for (let i = 0; i < 2 * n + 5; i++) {
      sessions.set(`s${i}`, session(`s${i}`));
      evs.push(...events(1, `s${i}`));
    }
    const { plans } = planBatches(ENV, { sessions, dirty: [], events: evs, errors: [] });
    assert.deepEqual(plans.map((p) => p.sessions.length), [n, n, 5]);
    for (const p of plans) {
      const ids = new Set(p.sessions.map((s) => s.sessionId));
      for (const e of p.events) assert.ok(ids.has(e.sessionId));
    }
  });

  it('sends changed sessions that have no items, and none twice', () => {
    const sessions = new Map([
      ['s1', session('s1')],
      ['s2', session('s2')],
      ['s3', session('s3')],
    ]);
    const { plans } = planBatches(ENV, { sessions, dirty: ['s1', 's2'], events: events(2, 's1'), errors: [] });
    assert.equal(plans.length, 1);
    assert.deepEqual(plans[0]!.sessions.map((s) => s.sessionId), ['s1', 's2']);
  });

  it('does not add a session for errors without one', () => {
    const { plans } = planBatches(ENV, input({ errors: errors(2, null) }));
    assert.equal(plans[0]!.sessions.length, 0);
    assert.equal(plans[0]!.errors.length, 2);
  });

  it('reports items that cannot fit any batch', () => {
    const tiny = { bodyBytes: 900, sessions: 20, events: 500, errors: 50 };
    const huge = events(1, 's1', { a: 'z'.repeat(600) });
    const { plans, oversized } = planBatches(ENV, input({ events: [...huge, ...events(1)] }), tiny);
    assert.equal(oversized.length, 1);
    assert.equal(oversized[0], huge[0]);
    assert.equal(plans.length, 1);
  });

  it('returns no plans for nothing', () => {
    assert.deepEqual(planBatches(ENV, input({})).plans, []);
  });
});
