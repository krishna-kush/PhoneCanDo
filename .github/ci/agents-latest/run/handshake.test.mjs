// handshake.mjs with a fake ACP agent (test/fake-acp.mjs) in each of its modes.
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import { lacking } from '../logic/acp.mjs';
import { handshake } from './handshake.mjs';

const FAKE = fileURLToPath(new URL('../test/fake-acp.mjs', import.meta.url));
const shake = (mode, timeoutMs = 10_000) => handshake([process.execPath, FAKE], { env: { ...process.env, FAKE_ACP: mode }, timeoutMs });

describe('handshake', () => {
  it('sends the runner initialize, refuses what the agent asks and reads the answer', async () => {
    const r = await shake('ok');
    assert.equal(r.answer.error, null);
    assert.equal(r.answer.result.agentInfo.name, 'fake-acp');
    assert.deepEqual(lacking(r.answer.result, ['agentCapabilities.loadSession', 'agentCapabilities.sessionCapabilities.resume']), []);
    assert.match(r.log, /fake-acp starting/, 'a line that is no answer goes to the log');
  });

  it('reads what a lacking answer misses', async () => {
    const r = await shake('lacking');
    assert.deepEqual(lacking(r.answer.result, ['agentCapabilities.loadSession', 'agentCapabilities.mcpCapabilities.http']), [
      { path: 'agentCapabilities.loadSession', value: false },
      { path: 'agentCapabilities.mcpCapabilities.http', value: undefined },
    ]);
  });

  it('passes an error answer on', async () => {
    const r = await shake('error');
    assert.deepEqual(r.answer.error, { code: -32603, message: 'internal error' });
  });

  it('notes an agent that exits first, with its stderr', async () => {
    const r = await shake('exit');
    assert.equal(r.answer, null);
    assert.equal(r.code, 3);
    assert.equal(r.timedOut, false);
    assert.match(r.log, /giving up/);
  });

  it('gives up on an agent that never answers', async () => {
    const r = await shake('silent', 500);
    assert.equal(r.answer, null);
    assert.equal(r.timedOut, true);
  });

  it('notes a program that cannot start', async () => {
    const r = await handshake(['/nonexistent/agent'], { timeoutMs: 5000 });
    assert.equal(r.answer, null);
    assert.equal(r.code, 127);
  });
});
