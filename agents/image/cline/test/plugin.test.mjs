// Our Cline plugin (config/phonecando.js) as Cline drives it: its hooks
// called with the contexts Cline passes, against an inbox folder laid out
// as the runner lays it out. What it trusts, the events it raises (each one
// agent.json maps), what it claims and receipts, and the wake.
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import plugin, { ASK_TOOLS, EVENTS, PROMPT_MAX_MS, claim, createPlugin, endEvent, peek, takePrompt, trusted } from '../config/phonecando.js';

const MANIFEST = JSON.parse(readFileSync(new URL('../agent.json', import.meta.url), 'utf8'));
const PLUGIN_TEXT = readFileSync(new URL('../config/phonecando.js', import.meta.url), 'utf8');
const LAUNCH_TEXT = readFileSync(new URL('../config/launch.sh', import.meta.url), 'utf8');

const made = [];
after(() => made.forEach((dir) => rmSync(dir, { recursive: true, force: true })));

function folder() {
  const dir = mkdtempSync(join(tmpdir(), 'cline-plugin-'));
  made.push(dir);
  return dir;
}

function inbox({ wake = false, txt = true } = {}) {
  const dir = folder();
  fill(dir, { wake, txt });
  return dir;
}

function fill(dir, { wake = false, txt = true } = {}) {
  const pending = join(dir, 'pending');
  mkdirSync(pending);
  writeFileSync(join(pending, 'ids'), '12\n13\n');
  if (txt) writeFileSync(join(pending, 'messages.txt'), '<agent-message id="12">a</agent-message>\n');
  writeFileSync(
    join(pending, 'messages.jsonl'),
    `${JSON.stringify({ id: 12, block: 'block 12' })}\n${JSON.stringify({ id: 13, block: 'block 13' })}\n`,
  );
  if (wake) writeFileSync(join(pending, 'wake'), '');
}

// A plugin with our env and a recorder for what it raises.
function live(env = {}) {
  const raised = [];
  const events = join(folder(), 'events');
  writeFileSync(events, '');
  const p = createPlugin({
    env: { PHONECANDO_BRIDGE_URL: 'http://127.0.0.1:1', PHONECANDO_EVENTS: events, ...env },
    raise: (name) => raised.push(name),
    every: 10,
  });
  return { p, raised, events };
}

const root = { agentId: 'a1', parentAgentId: null };
const sub = { agentId: 'a2', parentAgentId: 'a1' };
const tool = (toolName, snapshot = root) => ({ snapshot, toolCall: { toolCallId: 't1', toolName, input: {} } });

test('trusts our tools only', () => {
  assert.ok(trusted('phonecando__mobile_ping'));
  assert.ok(trusted('phonecando__agents_send'));
  for (const name of ['phonecando__', 'phonecando_mobile_ping', 'run_commands', 'editor', 'other__phonecando__x', undefined, 42]) {
    assert.equal(trusted(name), false, String(name));
  }
});

test('beforeTool approves our tools, sub-agents too, and leaves the rest to Cline', async () => {
  const { p } = live();
  assert.deepEqual(await p.hooks.beforeTool(tool('phonecando__mobile_ping')), { policy: { autoApprove: true } });
  assert.deepEqual(await p.hooks.beforeTool(tool('phonecando__agents_wait', sub)), { policy: { autoApprove: true } });
  assert.equal(await p.hooks.beforeTool(tool('run_commands')), undefined);
  assert.equal(await p.hooks.beforeTool(tool('editor')), undefined);
  // Without the bridge nothing of ours runs, so nothing is trusted.
  const noBridge = createPlugin({ env: { PHONECANDO_INBOX: folder() }, raise: () => {} });
  assert.equal(await noBridge.hooks.beforeTool(tool('phonecando__mobile_ping')), undefined);
});

test('without our variables it is a bare plugin: no hooks, no setup', () => {
  const bare = createPlugin({ env: {} });
  assert.deepEqual(bare, { name: 'phonecando', manifest: { capabilities: ['hooks'] } });
  assert.equal(typeof plugin.name, 'string');
  assert.ok(plugin.manifest.capabilities.includes('hooks'));
});

test('raises the events agent.json maps, in order, and none for a sub-agent', async () => {
  const { p, raised } = live();
  await p.hooks.beforeRun({ snapshot: root });
  await p.hooks.beforeTool(tool('ask_followup_question'));
  await p.hooks.afterTool(tool('ask_followup_question'));
  await p.hooks.afterRun({ snapshot: root, result: { status: 'completed' } });
  await p.hooks.beforeRun({ snapshot: sub });
  await p.hooks.beforeTool(tool('ask_question', sub));
  await p.hooks.afterRun({ snapshot: sub, result: { status: 'failed' } });
  assert.deepEqual(raised, ['RunStart', 'AskUser', 'AskDone', 'RunDone']);

  const map = MANIFEST.events.find((e) => e.hook).hook.map;
  assert.deepEqual(Object.keys(map).sort(), Object.values(EVENTS).sort());
  assert.deepEqual(
    Object.fromEntries(Object.values(EVENTS).map((n) => [n, map[n]])),
    { RunStart: 'working', AskUser: 'waiting', AskDone: 'working', RunDone: 'finished', RunFailed: 'failed', RunStopped: 'stopped' },
  );
  assert.deepEqual(ASK_TOOLS, ['ask_question', 'ask_followup_question']);
});

test('a run ends done, failed or stopped', () => {
  assert.equal(endEvent({ status: 'completed' }), 'RunDone');
  assert.equal(endEvent({ status: 'failed' }), 'RunFailed');
  assert.equal(endEvent({ status: 'completed', error: { message: 'x' } }), 'RunFailed');
  assert.equal(endEvent({ status: 'aborted' }), 'RunStopped');
  assert.equal(endEvent(undefined), 'RunDone');
});

test('peek and claim read the folder as phonecando-inbox does, and receipt the ids', () => {
  assert.deepEqual(peek(folder()), { waiting: false, wake: false });
  const dir = inbox({ wake: true });
  assert.deepEqual(peek(dir), { waiting: true, wake: true });
  const events = join(folder(), 'events');
  const c = claim(dir, events);
  assert.deepEqual(c, { ids: ['12', '13'], text: '<agent-message id="12">a</agent-message>', wake: true });
  assert.equal(readFileSync(events, 'utf8'), '@inbox\t12 13\n');
  assert.deepEqual(readdirSync(dir), []);
  assert.equal(claim(dir, events), null);
  // No messages.txt: the rendered blocks.
  assert.equal(claim(inbox({ txt: false }), undefined).text, 'block 12\n\nblock 13');
});

test('a run takes waiting messages at its start and after each tool, as hook context', async () => {
  const dir = folder();
  const { p, events } = live({ PHONECANDO_INBOX: dir });
  assert.equal(await p.hooks.beforeRun({ snapshot: root }), undefined);
  fill(dir);
  assert.deepEqual(await p.hooks.afterTool(tool('run_commands')), { appendContext: '<agent-message id="12">a</agent-message>' });
  assert.equal(readFileSync(events, 'utf8'), '@inbox\t12 13\n');
  assert.equal(existsSync(join(dir, 'pending')), false);
  fill(dir);
  assert.deepEqual(await p.hooks.beforeRun({ snapshot: root }), { appendContext: '<agent-message id="12">a</agent-message>' });
  // A sub-agent's tools never take them.
  fill(dir);
  assert.equal(await p.hooks.afterTool(tool('run_commands', sub)), undefined);
  assert.ok(existsSync(join(dir, 'pending')));
});

test('idle: a wake-marked set is queued as a prompt; others wait; nothing while a run works', async () => {
  const dir = folder();
  const { p, events } = live({ PHONECANDO_INBOX: dir });
  const sent = [];
  let dispose;
  p.setup({}, { emitEvent: (name, payload) => sent.push({ name, payload }), onDispose: (fn) => (dispose = fn) });
  try {
    fill(dir); // no wake mark: waits for your next prompt
    await delay(60);
    assert.deepEqual(sent, []);
    assert.ok(existsSync(join(dir, 'pending')));
    rmSync(join(dir, 'pending'), { recursive: true });

    await p.hooks.beforeRun({ snapshot: root }); // working: the run's hooks take them
    fill(dir, { wake: true });
    await delay(60);
    assert.deepEqual(sent, []);
    await p.hooks.afterRun({ snapshot: root, result: { status: 'completed' } });

    await delay(60); // idle now, and the set may wake it
    assert.deepEqual(sent, [{ name: 'queue_message', payload: { prompt: '<agent-message id="12">a</agent-message>' } }]);
    assert.equal(readFileSync(events, 'utf8'), '@inbox\t12 13\n');
    assert.equal(existsSync(join(dir, 'pending')), false);

    // One queued wake at a time until its run starts.
    fill(dir, { wake: true });
    await delay(60);
    assert.equal(sent.length, 1);
  } finally {
    dispose?.();
  }
});

test('no wake in ACP mode, where only the runner prompts', async () => {
  const dir = folder();
  const { p } = live({ PHONECANDO_INBOX: dir });
  const sent = [];
  let dispose;
  p.setup({}, { client: { name: 'cline-acp' }, emitEvent: (...a) => sent.push(a), onDispose: (fn) => (dispose = fn) });
  fill(dir, { wake: true });
  await delay(60);
  dispose?.();
  assert.deepEqual(sent, []);
  assert.equal(dispose, undefined);
});

test('the file carries the mark launch.sh looks for, and our tools by prefix only', () => {
  const mark = LAUNCH_TEXT.match(/^mark='([^']+)'$/m)?.[1];
  assert.ok(mark);
  assert.ok(PLUGIN_TEXT.split('\n')[0].includes(mark));
  assert.ok(PLUGIN_TEXT.includes(MANIFEST.phoneToolsTrust.has));
  assert.equal(MANIFEST.phoneToolsTrust.in, 'phonecando.js');
});

test('a first prompt handed over by launch.sh is taken once, fresh only, and the file goes', () => {
  const file = join(folder(), 'phonecando-prompt.json');
  writeFileSync(file, JSON.stringify({ at: 1_000, prompt: 'go on' }));
  assert.equal(takePrompt(file, 1_000 + PROMPT_MAX_MS), 'go on');
  assert.equal(existsSync(file), false);
  assert.equal(takePrompt(file, 2_000), undefined);
  // Too old (a later session), from the future, or not ours: dropped, and the file goes.
  for (const text of [
    JSON.stringify({ at: 1_000, prompt: 'old' }),
    JSON.stringify({ at: 9_999_999, prompt: 'future' }),
    JSON.stringify({ prompt: 'no time' }),
    'not json',
  ]) {
    writeFileSync(file, text);
    assert.equal(takePrompt(file, 1_001 + PROMPT_MAX_MS), undefined, text);
    assert.equal(existsSync(file), false);
  }
});

test('setup sends the handed-over prompt into the reopened chat, not in ACP mode', () => {
  const file = join(folder(), 'phonecando-prompt.json');
  const at = Date.now();
  const sent = [];
  writeFileSync(file, JSON.stringify({ at, prompt: 'go on' }));
  createPlugin({ env: { PHONECANDO_EVENTS: join(folder(), 'e'), PHONECANDO_CLINE_PROMPT: file }, raise: () => {} })
    .setup({}, { emitEvent: (name, payload) => sent.push({ name, payload }) });
  assert.deepEqual(sent, [{ name: 'queue_message', payload: { prompt: 'go on' } }]);
  assert.equal(existsSync(file), false);
  writeFileSync(file, JSON.stringify({ at, prompt: 'go on' }));
  createPlugin({ env: { PHONECANDO_EVENTS: join(folder(), 'e'), PHONECANDO_CLINE_PROMPT: file }, raise: () => {} })
    .setup({}, { client: { name: 'cline-acp' }, emitEvent: (name, payload) => sent.push({ name, payload }) });
  assert.equal(sent.length, 1);
});
