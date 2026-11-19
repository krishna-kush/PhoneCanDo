#!/usr/bin/env node
// A fake ACP agent for the harness's tests: reads JSON-RPC lines on stdin
// and answers initialize as FAKE_ACP says:
//   ok       a banner and a notification first, then asks the client a
//            question (fs/read_text_file) and answers initialize only once
//            the client said it is not offered; loadSession, HTTP MCP and
//            session resume on
//   lacking  as ok, but loadSession false and no mcpCapabilities
//   error    an error answer
//   exit     exits 3 without answering
//   silent   never answers
// An initialize that is not the runner's (AcpWire.initialize) gets an error.
// It exits 0 when its stdin closes.
import { createInterface } from 'node:readline';

const mode = process.env.FAKE_ACP ?? 'ok';
const send = (message) => process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', ...message })}\n`);
let initializeId = null;

function answer(id) {
  if (mode === 'error') return send({ id, error: { code: -32603, message: 'internal error' } });
  const lacking = mode === 'lacking';
  send({
    id,
    result: {
      protocolVersion: 1,
      agentCapabilities: {
        loadSession: !lacking,
        ...(lacking ? {} : { mcpCapabilities: { http: true, sse: false } }),
        sessionCapabilities: { resume: {} },
      },
      authMethods: [],
      agentInfo: { name: 'fake-acp', version: '1.2.3' },
    },
  });
}

function runners(params) {
  const caps = params?.clientCapabilities;
  return (
    params?.protocolVersion === 1 &&
    caps?.fs?.readTextFile === false &&
    caps?.fs?.writeTextFile === false &&
    caps?.terminal === false &&
    caps?.auth?.terminal === false &&
    params?.clientInfo?.name === 'phonecando'
  );
}

if (mode === 'exit') {
  process.stderr.write('fake-acp: giving up\n');
  process.exit(3);
}

createInterface({ input: process.stdin }).on('line', (line) => {
  const message = JSON.parse(line);
  if (message.method === 'initialize') {
    if (!runners(message.params)) return send({ id: message.id, error: { code: -32602, message: 'not the runner initialize' } });
    if (mode === 'silent') return;
    initializeId = message.id;
    process.stdout.write('fake-acp starting\n');
    send({ method: 'session/update', params: { note: 'hello' } });
    send({ id: 'q1', method: 'fs/read_text_file', params: { path: '/etc/hostname' } });
  } else if (message.id === 'q1' && initializeId !== null) {
    if (message.error?.code !== -32601) return send({ id: initializeId, error: { code: -32000, message: 'question not refused' } });
    answer(initializeId);
  }
});
process.stdin.on('end', () => process.exit(0));
