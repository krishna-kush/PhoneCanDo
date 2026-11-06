import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { ErrorWire, EventWire } from '../core/schema/wire.ts';
import { countItems, emptyQueue, enforceCap, isIdle, parseQueue, pruneSessions, serializeQueue, type QueueState } from './queue.ts';

const OLD = '00000000-0000-4000-8000-0000000000a1';
const CUR = '00000000-0000-4000-8000-0000000000a2';
const A = '00000000-0000-4000-8000-0000000000a3';
const GHOST = '00000000-0000-4000-8000-0000000000a4';
const E1 = '00000000-0000-4000-8000-0000000000e1';
const E2 = '00000000-0000-4000-8000-0000000000e2';
const S = '00000000-0000-4000-8000-0000000000a5';

function ev(sessionId: string, seq: number): EventWire {
  return { sessionId, seq, ts: 100 + seq, name: 'chat.open' };
}

function er(id: string, sessionId: string | null): ErrorWire {
  return { errorId: id, sessionId, seq: null, ts: 50, kind: 'native', className: 'X', message: 'm', frames: [] };
}

function sample(): QueueState {
  return {
    sessions: [
      { wire: { sessionId: OLD, startedAt: 1 }, dirty: false, rev: 0, nextSeq: 3 },
      { wire: { sessionId: CUR, startedAt: 2, bootMs: 900 }, dirty: true, rev: 4, nextSeq: 9 },
    ],
    events: [ev(OLD, 1), ev(CUR, 1), ev(CUR, 2)],
    errors: [er(E1, null), er(E2, CUR)],
  };
}

describe('queue persistence', () => {
  it('drops engine output an older build queued', () => {
    const raw = JSON.stringify({
      v: 1,
      sessions: [{ wire: { sessionId: CUR, startedAt: 2, engineExitCode: 1, engineStderrTail: 'prompt: secret plans' }, dirty: true, nextSeq: 2 }],
      events: [],
      errors: [{ ...er(E1, CUR), kind: 'engine', className: 'exit 1', message: 'prompt: secret plans' }],
    });
    const parsed = parseQueue(raw);
    assert.ok(parsed.ok);
    const q = parsed.value.queue;
    assert.deepEqual(q.sessions[0]!.wire, { sessionId: CUR, startedAt: 2, engineExitCode: 1 });
    assert.equal(q.errors[0]!.message, 'exit 1');
    assert.ok(!serializeQueue(q).includes('secret plans'));
  });

  it('round-trips through JSON', () => {
    const parsed = parseQueue(serializeQueue(sample()));
    assert.ok(parsed.ok);
    assert.equal(parsed.value.skipped, 0);
    const q = parsed.value.queue;
    assert.deepEqual(q.events, sample().events);
    assert.deepEqual(q.errors, sample().errors);
    assert.deepEqual(q.sessions.map((s) => [s.wire, s.dirty, s.nextSeq]), sample().sessions.map((s) => [s.wire, s.dirty, s.nextSeq]));
  });

  it('keeps the current session pointer, only while the queue holds that session', () => {
    const withPointer = parseQueue(serializeQueue(sample(), CUR));
    assert.ok(withPointer.ok);
    assert.equal(withPointer.value.current, CUR);
    // Written before the pointer existed, or pointing at a session that is gone.
    const without = parseQueue(serializeQueue(sample()));
    assert.ok(without.ok);
    assert.equal(without.value.current, null);
    assert.equal(JSON.parse(serializeQueue(sample())).current, undefined);
    const dangling = parseQueue(serializeQueue(sample(), GHOST));
    assert.ok(dangling.ok);
    assert.equal(dangling.value.current, null);
    const wrongType = parseQueue(JSON.stringify({ ...JSON.parse(serializeQueue(sample())), current: 7 }));
    assert.ok(wrongType.ok);
    assert.equal(wrongType.value.current, null);
  });

  it('treats a missing value as empty', () => {
    const parsed = parseQueue(null);
    assert.ok(parsed.ok);
    assert.equal(countItems(parsed.value.queue), 0);
    assert.equal(parsed.value.current, null);
  });

  it('rejects garbage and foreign formats', () => {
    for (const raw of ['{not json', '[]', '{"v":2,"sessions":[],"events":[],"errors":[]}', '{"v":1}', 'null']) {
      const parsed = parseQueue(raw);
      assert.equal(parsed.ok, false, raw);
      if (!parsed.ok) assert.equal(parsed.error.code, 'bad_request');
    }
  });

  it('skips malformed items, drops unknown names and recreates missing sessions', () => {
    const raw = JSON.stringify({
      v: 1,
      sessions: [{ wire: { sessionId: A, startedAt: 1 }, dirty: true, nextSeq: 2 }, { wire: {} }, 'x'],
      events: [ev(A, 1), ev(GHOST, 1), { sessionId: A, seq: 'x', ts: 1, name: 'chat.open' }, { ...ev(A, 2), name: 'no.such.event' }],
      errors: [er(E1, null), er(E1, null), { errorId: 'e3' }, er('not-a-uuid', null)],
    });
    const parsed = parseQueue(raw);
    assert.ok(parsed.ok);
    const { queue, skipped } = parsed.value;
    assert.equal(skipped, 7);
    assert.deepEqual(queue.events.map((e) => `${e.sessionId}:${e.seq}`), [`${A}:1`, `${GHOST}:1`]);
    assert.deepEqual(queue.errors.map((e) => e.errorId), [E1]);
    const ghost = queue.sessions.find((s) => s.wire.sessionId === GHOST);
    assert.deepEqual(ghost?.wire, { sessionId: GHOST, startedAt: 101 });
  });
});

describe('queue cap and pruning', () => {
  it('drops oldest events first, then errors, then unreferenced sessions, never the current one', () => {
    const q = sample(); // 2 sessions + 3 events + 2 errors = 7
    assert.equal(enforceCap(q, 5, CUR), 2);
    assert.deepEqual(q.events.map((e) => `${e.sessionId}:${e.seq}`), [`${CUR}:2`]);
    assert.equal(q.errors.length, 2);

    assert.equal(enforceCap(q, 3, CUR), 2);
    assert.equal(q.events.length, 0);
    assert.deepEqual(q.errors.map((e) => e.errorId), [E2]);

    assert.equal(enforceCap(q, 1, CUR), 2); // e2 goes, then OLD (unreferenced)
    assert.deepEqual(q.sessions.map((s) => s.wire.sessionId), [CUR]);
    assert.equal(q.errors.length, 0);

    assert.equal(enforceCap(q, 0, CUR), 0);
    assert.equal(q.sessions.length, 1);
  });

  it('prunes clean, unreferenced, non-current sessions', () => {
    const q = sample();
    q.events = q.events.filter((e) => e.sessionId !== OLD);
    pruneSessions(q, CUR);
    assert.deepEqual(q.sessions.map((s) => s.wire.sessionId), [CUR]);
  });

  it('is idle only without items and changed sessions', () => {
    const q = emptyQueue();
    assert.ok(isIdle(q));
    q.sessions.push({ wire: { sessionId: S, startedAt: 1 }, dirty: false, rev: 0, nextSeq: 1 });
    assert.ok(isIdle(q));
    q.sessions[0]!.dirty = true;
    assert.equal(isIdle(q), false);
  });
});
