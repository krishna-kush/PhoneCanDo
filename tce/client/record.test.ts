// track() and error(): event names, the shared per-session sequence,
// truncation and redaction, error ids and the session an error is filed under.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { LIMITS } from '../core/schema/limits.ts';
import { assertServerAccepts, batches, setup } from './harness.ts';

describe('track and error', () => {
  it('drops unknown event names and logs them', async () => {
    const { client, net, log } = setup();
    await client.init();
    client.startSession();
    client.track('totally.made_up');
    client.track('provider.Anthropic');
    client.track('tool.mobile_click');
    await client.flush();
    assert.deepEqual(batches(net)[0]!.events.map((e) => e.name), ['tool.mobile_click']);
    assert.ok(log.has('warn', 'unknown event'));
  });

  it('shares one sequence between events and errors per session', async () => {
    const { client, net } = setup();
    await client.init();
    const s1 = client.startSession();
    client.track('chat.open');
    client.error({ kind: 'js', className: 'TypeError', message: 'boom', frames: [] });
    client.track('terminal.open');
    const s2 = client.startSession();
    client.track('env.add');
    await client.flush();
    const b = batches(net)[0]!;
    assert.deepEqual(b.events.map((e) => [e.sessionId, e.seq]), [
      [s1, 1],
      [s1, 3],
      [s2, 1],
    ]);
    assert.deepEqual(b.errors.map((e) => [e.sessionId, e.seq]), [[s1, 2]]);
    const first = b.sessions.find((s) => s.sessionId === s1)!;
    assert.equal(typeof first.endedAt, 'number');
  });

  it('truncates props and error fields and redacts paths before queueing', async () => {
    const { client, net } = setup();
    await client.init();
    client.startSession();
    client.track('chat.open', { ['k'.repeat(80)]: 'v'.repeat(500), path: '/storage/emulated/0/Download/x.txt' });
    client.error({
      kind: 'js',
      className: 'Error',
      message: `ENOENT: open '/data/user/0/com.phonecando.app/files/${'z'.repeat(300)}'`,
      frames: ['at a (file:///data/user/0/x/index.bundle:1:2)', 'b', 'c', 'd', 'e', 'f', 'g'],
    });
    await client.flush();
    const b = batches(net)[0]!;
    const props = b.events[0]!.props!;
    assert.equal(Object.keys(props)[0]!.length, LIMITS.propKeyLength);
    assert.equal(props.path, '<path>');
    assert.ok(Object.values(props).every((v) => typeof v !== 'string' || v.length <= LIMITS.propStringLength));
    const e = b.errors[0]!;
    assert.ok(e.message.startsWith("ENOENT: open '<path>'"));
    assert.ok(e.message.length <= LIMITS.errorMessage);
    assert.deepEqual(e.frames, ['at a (<path>:1:2)', 'b', 'c', 'd', 'e']);
  });

  it('keeps native errors idempotent by their own id, without a session', async () => {
    const { client, net } = setup();
    await client.init();
    client.startSession();
    const crash = {
      kind: 'native' as const,
      errorId: 'ABCDEF01-2345-4678-89AB-CDEF01234567',
      sessionId: null,
      ts: 1_749_999_000_000,
      className: 'java.lang.IllegalStateException',
      message: 'bad',
      frames: ['com.x.Y.z(Y.kt:1)'],
      version: '0.1.2',
    };
    client.error(crash);
    client.error(crash);
    await client.flush();
    const b = batches(net)[0]!;
    assert.equal(b.errors.length, 1);
    assert.deepEqual(
      { ...b.errors[0]! },
      {
        errorId: 'abcdef01-2345-4678-89ab-cdef01234567',
        sessionId: null,
        seq: null,
        ts: 1_749_999_000_000,
        kind: 'native',
        className: 'java.lang.IllegalStateException',
        message: 'bad',
        frames: ['com.x.Y.z(Y.kt:1)'],
        version: '0.1.2',
      },
    );
  });

  it('starts a session on its own when an event comes first', async () => {
    const { client, net } = setup();
    await client.init();
    client.track('chat.open');
    await client.flush();
    const b = batches(net)[0]!;
    assert.equal(b.sessions.length, 1);
    assert.equal(b.events[0]!.sessionId, b.sessions[0]!.sessionId);
  });

  it('replaces an error id the server would reject', async () => {
    const { client, net } = setup();
    await client.init();
    client.error({ kind: 'native', errorId: '00000000-0000-0000-0000-000000000000', sessionId: null, className: 'E', message: 'm', frames: [] });
    await client.flush();
    assert.notEqual(batches(net)[0]!.errors[0]!.errorId, '00000000-0000-0000-0000-000000000000');
    assertServerAccepts(net);
  });

  it('sends an engine error as its exit code only', async () => {
    const { client, net } = setup();
    await client.init();
    client.startSession();
    client.error({ kind: 'engine', className: 'exit 137', message: 'prompt: my diary', frames: [] });
    await client.flush();
    const e = batches(net)[0]!.errors[0]!;
    assert.deepEqual([e.className, e.message], ['exit 137', 'exit 137']);
    assert.ok(!net.sent[0]!.body.includes('diary'));
  });

  it('files an error timed before the current session under no session', async () => {
    const { client, net, clock } = setup();
    await client.init();
    const before = clock.now() - 60_000;
    const sid = client.startSession();
    client.error({ kind: 'engine', className: 'exit 1', message: 'exit 1', frames: [], ts: before });
    client.error({ kind: 'engine', className: 'exit 2', message: 'exit 2', frames: [], ts: clock.now() });
    await client.flush();
    const errs = batches(net)[0]!.errors;
    assert.deepEqual(
      errs.map((e) => [e.className, e.sessionId, e.seq, e.ts]),
      [
        ['exit 1', null, null, before],
        ['exit 2', sid, 1, clock.now()],
      ],
    );
    assertServerAccepts(net);
  });
});
