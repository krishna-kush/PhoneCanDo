// capabilities.mjs: what each kind can do, read from its manifest.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { capabilities, COLUMNS, table } from './capabilities.mjs';
import { loadManifests } from './manifests.mjs';

const kind = (id, manifest) => ({ id, manifest });
const tui = (more = {}) => ({ style: 'tui', launch: { argv: ['x'] }, ...more });

describe('capabilities.mjs', () => {
  it('says what Start me again does, as the runner decides it', () => {
    const rows = capabilities([
      kind('hook', { phoneTools: 'mcp:argv', inbox: { wake: 'hook' }, engine: tui({ prompt: {}, resume: {} }) }),
      kind('restart', { phoneTools: 'mcp:argv', engine: tui({ prompt: {}, resume: {}, acp: {} }) }),
      kind('switch', { phoneTools: 'mcp:config', engine: tui({ resume: {}, acp: {} }) }),
      kind('waits', { phoneTools: 'mcp:argv', engine: tui({ resume: {} }) }),
      kind('none', { phoneTools: 'none', engine: tui({ prompt: {}, resume: {} }) }),
    ]);
    assert.deepEqual(
      rows.map((r) => [r.id, r.again]),
      [['hook', 'woken'], ['restart', 'restart'], ['switch', 'acp if listed'], ['waits', 'waits'], ['none', '-']],
    );
  });

  it('names where an MCP kind trusts our server, and a missing one', () => {
    const [named, missing, plugin] = capabilities([
      kind('a', { phoneTools: 'mcp:argv', phoneToolsTrust: { in: 'argv', has: 'x' }, engine: tui() }),
      kind('b', { phoneTools: 'mcp:config', engine: tui() }),
      kind('c', { phoneTools: 'plugin', engine: tui() }),
    ]);
    assert.deepEqual([named.trust, missing.trust, plugin.trust], ['argv', 'MISSING', '-']);
  });

  it('reads messages as the site cards do', () => {
    const rows = capabilities([
      kind('w', { phoneTools: 'plugin', inbox: { reader: true, wake: 'reader' }, engine: tui() }),
      kind('d', { phoneTools: 'mcp:argv', inbox: { hooks: {} }, engine: tui() }),
      kind('i', { phoneTools: 'mcp:argv', engine: tui() }),
      kind('n', { phoneTools: 'none', engine: tui() }),
    ]);
    assert.deepEqual(rows.map((r) => r.messages), ['wakes', 'delivered', 'inbox', 'none']);
  });

  it('lines the columns up under a header', () => {
    const lines = table(capabilities([kind('k', { phoneTools: 'none', engine: tui() })]));
    assert.equal(lines.length, 2);
    assert.ok(lines[0].startsWith('id'));
    assert.equal(lines[0].split(/\s{2,}/).length, COLUMNS.length);
  });

  it('finds no MCP kind of ours without its trust', () => {
    const rows = capabilities(loadManifests());
    assert.deepEqual(rows.filter((r) => r.trust === 'MISSING').map((r) => r.id), []);
    assert.ok(rows.some((r) => r.id === 'codex' && r.again === 'restart'));
  });
});
