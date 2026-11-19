// logic/acp.mjs: the runner's initialize, line reading and the required paths.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { agentOf, describeLacking, initializeRequest, lacking, METHOD_NOT_FOUND, readLine, valueAt } from './acp.mjs';

describe('initializeRequest', () => {
  it('is AcpWire.initialize: no file system, no terminal, no sign-in through one', () => {
    assert.deepEqual(JSON.parse(initializeRequest('ci')), {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: 1,
        clientCapabilities: { fs: { readTextFile: false, writeTextFile: false }, terminal: false, auth: { terminal: false } },
        clientInfo: { name: 'phonecando', title: 'PhoneCanDo', version: 'ci' },
      },
    });
    assert.ok(!initializeRequest('ci').includes('\n'), 'one line');
  });
});

describe('readLine', () => {
  it('takes our answer, by number or string id', () => {
    assert.deepEqual(readLine('{"jsonrpc":"2.0","id":1,"result":{"a":1}}'), { kind: 'answer', result: { a: 1 }, error: null });
    assert.deepEqual(readLine('{"id":"1","error":{"code":-1,"message":"x"}}'), { kind: 'answer', result: {}, error: { code: -1, message: 'x' } });
  });

  it('refuses a request the agent makes of us, echoing its id', () => {
    const r = readLine('{"jsonrpc":"2.0","id":"q","method":"terminal/create","params":{}}');
    assert.equal(r.kind, 'request');
    assert.deepEqual(JSON.parse(r.reply), {
      jsonrpc: '2.0',
      id: 'q',
      error: { code: METHOD_NOT_FOUND, message: 'terminal/create is not offered' },
    });
  });

  it('skips the rest', () => {
    for (const line of ['banner', '', '[]', 'null', '{"method":"session/update","params":{}}', '{"id":7,"result":{}}']) {
      assert.equal(readLine(line), null, line);
    }
  });
});

describe('required paths', () => {
  const result = {
    agentCapabilities: { loadSession: true, sessionCapabilities: { resume: {}, list: null }, mcpCapabilities: { http: false } },
    agentInfo: { name: 'a', version: '2' },
  };

  it('reads dotted paths, never past a missing step', () => {
    assert.equal(valueAt(result, 'agentCapabilities.loadSession'), true);
    assert.deepEqual(valueAt(result, 'agentCapabilities.sessionCapabilities.resume'), {});
    assert.equal(valueAt(result, 'agentCapabilities.nope.deeper'), undefined);
    assert.equal(valueAt(result, 'agentInfo.name.length'), undefined, 'a string has no keys here');
    assert.equal(valueAt(result, 'constructor'), undefined, 'own keys only');
  });

  it('counts an empty object as offered, false and null as not', () => {
    const paths = [
      'agentCapabilities.loadSession',
      'agentCapabilities.sessionCapabilities.resume',
      'agentCapabilities.sessionCapabilities.list',
      'agentCapabilities.mcpCapabilities.http',
      'agentCapabilities.promptCapabilities.image',
    ];
    const missing = lacking(result, paths);
    assert.deepEqual(missing.map((m) => m.path), paths.slice(2));
    assert.equal(
      describeLacking(missing),
      'agentCapabilities.sessionCapabilities.list (null), agentCapabilities.mcpCapabilities.http (false), agentCapabilities.promptCapabilities.image (absent)',
    );
  });

  it('names who answered', () => {
    assert.equal(agentOf(result), 'a 2');
    assert.equal(agentOf({}), '');
  });
});
