// tools.json is the generator's output, never edited by hand, and keeps
// only the tools MCP can serve as one bridge route.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { build, render, TABLE } from './gen-tools-json.mjs';

test('tools.json is up to date (node agents/shared/phone-tools/gen-tools-json.mjs)', async () => {
  assert.equal(readFileSync(TABLE, 'utf8'), await render());
});

test('one-route tools are served with the fields their run always sends', async () => {
  const { tools } = await build();
  const byName = Object.fromEntries(tools.map((t) => [t.name, t]));
  assert.deepEqual(
    { method: byName.mobile_ping.method, route: byName.mobile_ping.route, channel: byName.mobile_ping.channel },
    { method: 'GET', route: '/ping', channel: 'all' },
  );
  assert.deepEqual(byName.mobile_return.body, { tab: 'home', notify: true, reason: 'return' });
  assert.equal(byName.mobile_return.channel, 'full');
  assert.deepEqual(byName.mobile_request_unlock.body, { waitMs: 45_000 });
});

test('the agent messaging tools are served on every channel, one route each', async () => {
  const { tools } = await build();
  const byName = Object.fromEntries(tools.map((t) => [t.name, t]));
  const routes = Object.fromEntries(
    ['agents_list', 'agents_send', 'agents_inbox', 'agents_wait'].map((name) => [name, byName[name] && [byName[name].method, byName[name].route, byName[name].channel]]),
  );
  assert.deepEqual(routes, {
    agents_list: ['POST', '/agents/list', 'all'],
    agents_send: ['POST', '/agents/send', 'all'],
    agents_inbox: ['POST', '/agents/inbox', 'all'],
    agents_wait: ['POST', '/agents/wait', 'all'],
  });
  for (const name of Object.keys(routes)) assert.deepEqual(byName[name].body, {}, name);
});

test('the keep-running ask is served on every channel, one route', async () => {
  const { tools } = await build();
  const keep = tools.find((t) => t.name === 'agents_keep_running');
  assert.deepEqual([keep?.method, keep?.route, keep?.channel, keep?.body], ['POST', '/keep', 'all', {}]);
});

test('composed tools are left out, each with its reason', async () => {
  const { tools, omitted } = await build();
  const names = new Set(tools.map((t) => t.name));
  for (const name of ['mobile_launch', 'mobile_click', 'mobile_wait']) {
    assert.ok(!names.has(name), name);
    assert.match(omitted.find((o) => o.name === name)?.why ?? '', /\/pce\/observe/);
  }
});
