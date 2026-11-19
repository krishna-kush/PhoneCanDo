// Cline's stdio MCP server (config/phonecando-mcp.mjs) against a fake bridge
// that answers as runner/bridge/mcp/ does: JSON for a request, 202 and no
// body for a notification, 401 for a token it doesn't know. Each test runs
// the real script as Cline does, newline JSON on stdin and stdout, with an
// HTTP proxy set in its env that it must not use.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { createInterface } from 'node:readline';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const SCRIPT = fileURLToPath(new URL('../config/phonecando-mcp.mjs', import.meta.url));
const TOKEN = 'test-token-1234';
// What our cline_mcp_settings.json hands it while Cline expands nothing.
const ALIASES = { PHONECANDO_MCP_URL: '${env:PHONECANDO_BRIDGE_URL}', PHONECANDO_MCP_TOKEN: '${env:PHONECANDO_BRIDGE_TOKEN}' };
const DEAD_PROXY = { NODE_USE_ENV_PROXY: '1', http_proxy: 'http://127.0.0.1:9', HTTP_PROXY: 'http://127.0.0.1:9' };

const seen = [];
const bridge = createServer((req, res) => {
  let body = '';
  req.setEncoding('utf8');
  req.on('data', (chunk) => (body += chunk));
  req.on('end', async () => {
    const msg = JSON.parse(body);
    seen.push({ headers: req.headers, msg });
    if (req.method !== 'POST' || req.url !== '/mcp') return res.writeHead(404).end();
    if (req.headers.authorization !== `Bearer ${TOKEN}`) return res.writeHead(401).end();
    if (msg.id === undefined) return res.writeHead(202).end();
    const reply = (result, headers = {}) =>
      res.writeHead(200, { 'content-type': 'application/json', ...headers }).end(JSON.stringify({ jsonrpc: '2.0', id: msg.id, result }));
    switch (msg.method) {
      case 'initialize':
        return reply({ protocolVersion: '2025-11-25', capabilities: { tools: {} }, serverInfo: { name: 'phonecando' } }, { 'mcp-session-id': 's-1' });
      case 'tools/list':
        return reply({ tools: [{ name: 'agents_wait', inputSchema: { type: 'object' } }] });
      case 'tools/call':
        if (msg.params.name === 'slow') await delay(500);
        return reply({ content: [{ type: 'text', text: msg.params.name }] });
      case 'ping': {
        const data = JSON.stringify({ jsonrpc: '2.0', id: msg.id, result: {} });
        return res.writeHead(200, { 'content-type': 'text/event-stream' }).end(`event: message\ndata: ${data}\n\n`);
      }
      default:
        return reply({});
    }
  });
});
let url;

before(async () => {
  bridge.listen(0, '127.0.0.1');
  await once(bridge, 'listening');
  url = `http://127.0.0.1:${bridge.address().port}`;
});
after(() => {
  bridge.closeAllConnections();
  bridge.close();
});

// The script as Cline runs it: messages in, one JSON line per answer out.
function run(env) {
  const child = spawn(process.execPath, [SCRIPT], { env: { PATH: process.env.PATH, ...DEAD_PROXY, ...env } });
  const lines = [];
  const waiting = [];
  createInterface({ input: child.stdout }).on('line', (line) => {
    const msg = JSON.parse(line);
    const take = waiting.shift();
    if (take) take(msg);
    else lines.push(msg);
  });
  let stderr = '';
  child.stderr.setEncoding('utf8').on('data', (chunk) => (stderr += chunk));
  const exited = new Promise((resolve) => child.on('close', (code) => resolve(code)));
  return {
    send: (msg) => child.stdin.write(`${typeof msg === 'string' ? msg : JSON.stringify(msg)}\n`),
    next: () => (lines.length ? Promise.resolve(lines.shift()) : new Promise((resolve) => waiting.push(resolve))),
    end: () => (child.stdin.end(), exited),
    exited,
    stderr: () => stderr,
    lines,
  };
}

const bridgeEnv = (token = TOKEN) => ({ ...ALIASES, PHONECANDO_BRIDGE_URL: url, PHONECANDO_BRIDGE_TOKEN: token });
const call = (id, method, params = {}) => ({ jsonrpc: '2.0', id, method, params });

test('initialize, a notification with no line back, then tools/list in the same session', { timeout: 10_000 }, async () => {
  seen.length = 0;
  const p = run(bridgeEnv());
  p.send(call(1, 'initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'test' } }));
  assert.equal((await p.next()).result.serverInfo.name, 'phonecando');
  p.send({ jsonrpc: '2.0', method: 'notifications/initialized' });
  p.send(call(2, 'tools/list'));
  const list = await p.next();
  assert.equal(list.id, 2, 'the notification wrote nothing');
  assert.deepEqual(list.result.tools.map((t) => t.name), ['agents_wait']);
  assert.equal(await p.end(), 0);
  assert.deepEqual(p.lines, []);

  assert.deepEqual(seen.map((s) => s.msg.method), ['initialize', 'notifications/initialized', 'tools/list']);
  const last = seen.at(-1).headers;
  assert.equal(last.authorization, `Bearer ${TOKEN}`);
  assert.equal(last.accept, 'application/json, text/event-stream');
  assert.equal(last['mcp-session-id'], 's-1');
  assert.equal(seen[0].headers['mcp-session-id'], undefined);
  // Only Node's own warnings (its env proxy support on Node 22): nothing of ours.
  assert.doesNotMatch(p.stderr(), /phonecando-mcp|test-token/);
});

test('an SSE answer comes back as one line', { timeout: 10_000 }, async () => {
  const p = run(bridgeEnv());
  p.send(call('a', 'ping'));
  assert.deepEqual(await p.next(), { jsonrpc: '2.0', id: 'a', result: {} });
  assert.equal(await p.end(), 0);
});

test('a refused token becomes a JSON-RPC error with the same id, the token never shown', { timeout: 10_000 }, async () => {
  const p = run(bridgeEnv('wrong-token-5678'));
  p.send(call(7, 'initialize'));
  const answer = await p.next();
  assert.equal(answer.id, 7);
  assert.equal(answer.error.code, -32000);
  assert.match(answer.error.message, /HTTP 401/);
  p.send({ jsonrpc: '2.0', method: 'notifications/initialized' });
  assert.equal(await p.end(), 0);
  assert.deepEqual(p.lines, [], 'a refused notification writes nothing');
  assert.ok(!JSON.stringify(answer).includes('wrong-token') && !p.stderr().includes('wrong-token'));
});

test('a slow call does not hold up a fast one', { timeout: 10_000 }, async () => {
  const p = run(bridgeEnv());
  p.send(call(10, 'tools/call', { name: 'slow', arguments: {} }));
  p.send(call(11, 'tools/call', { name: 'fast', arguments: {} }));
  const first = await p.next();
  const second = await p.next();
  assert.deepEqual([first.id, second.id], [11, 10]);
  assert.equal(second.result.content[0].text, 'slow');
  assert.equal(await p.end(), 0);
});

test('takes the aliases once Cline fills them in', { timeout: 10_000 }, async () => {
  const p = run({ PHONECANDO_MCP_URL: `${url}/`, PHONECANDO_MCP_TOKEN: TOKEN });
  p.send(call(1, 'tools/list'));
  assert.equal((await p.next()).result.tools.length, 1);
  assert.equal(await p.end(), 0);
});

test('a bridge it cannot reach answers each request with an error', { timeout: 10_000 }, async () => {
  const gone = createServer();
  gone.listen(0, '127.0.0.1');
  await once(gone, 'listening');
  const port = gone.address().port;
  gone.close();
  const p = run({ ...bridgeEnv(), PHONECANDO_BRIDGE_URL: `http://127.0.0.1:${port}` });
  p.send(call(3, 'tools/list'));
  const answer = await p.next();
  assert.equal(answer.id, 3);
  assert.match(answer.error.message, /can't be reached \(ECONNREFUSED\)/);
  assert.equal(await p.end(), 0);
});

test('refuses a bridge off loopback, or none at all, before reading anything', { timeout: 10_000 }, async () => {
  for (const bridgeUrl of ['http://192.0.2.1:8080', 'https://127.0.0.1:8080', 'http://127.0.0.1.example.com']) {
    const env = { ...bridgeEnv(), PHONECANDO_BRIDGE_URL: bridgeUrl };
    const p = run(env);
    assert.equal(await p.exited, 1);
    assert.match(p.stderr(), /loopback/);
    assert.deepEqual(p.lines, []);
    assert.ok(!p.stderr().includes(TOKEN));
  }
  const none = run({});
  assert.equal(await none.exited, 1);
  assert.match(none.stderr(), /no PhoneCanDo bridge/);
});

test('leaves at once when Cline falls back to Content-Length framing', { timeout: 10_000 }, async () => {
  const p = run(bridgeEnv());
  p.send('Content-Length: 52\r');
  assert.equal(await p.exited, 1);
  assert.match(p.stderr(), /newline-delimited JSON only/);
});
