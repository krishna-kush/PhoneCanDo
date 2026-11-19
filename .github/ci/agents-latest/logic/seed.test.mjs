// logic/seed.mjs on made-up folders and on our own Cline kind.
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, it } from 'node:test';
import { loadManifests, REPO_ROOT } from '../../../../agents/kit/cli/manifests.mjs';
import { KIT_SCRIPTS, seedPlan } from './seed.mjs';

const TREE = {
  '/k/config': ['settings.json', 'hooks/hooks.json', 'node_modules/x/index.js', 'plugin/node_modules/y.js', 'run.mjs'],
  '/shared/tools': ['part.json', 'tools.json', 'gen.mjs', 'basic.ts', 'control/act.ts', 'control/gen.mjs', 'node_modules/z.js'],
};
const list = (dir) => TREE[dir] ?? [];
const entry = {
  dir: '/k',
  manifest: { config: { dir: 'config', into: '.phonecando/k' } },
  parts: [{ name: 'tools', dir: '/shared/tools', into: 'phone-tools', fullOnly: ['control/**'] }],
};
const plan = (e, configDir = '/root/.phonecando/k') => seedPlan({ entry: e, configDir, kitBin: '/root/.phonecando/bin', repo: '/repo', list });

describe('seedPlan', () => {
  it('puts the kit scripts in .phonecando/bin, runnable', () => {
    assert.deepEqual(
      plan(entry).filter((f) => f.exec),
      KIT_SCRIPTS.map((name) => ({ from: `/repo/agents/kit/scripts/${name}`, to: `/root/.phonecando/bin/${name}`, exec: true })),
    );
  });

  it('copies the config as the full channel packages it', () => {
    assert.deepEqual(plan(entry).filter((f) => !f.exec).map((f) => `${f.from} -> ${f.to}`), [
      '/k/config/settings.json -> /root/.phonecando/k/settings.json',
      '/k/config/hooks/hooks.json -> /root/.phonecando/k/hooks/hooks.json',
      '/k/config/run.mjs -> /root/.phonecando/k/run.mjs',
      '/shared/tools/basic.ts -> /root/.phonecando/k/phone-tools/basic.ts',
      '/shared/tools/control/act.ts -> /root/.phonecando/k/phone-tools/control/act.ts',
      '/shared/tools/control/gen.mjs -> /root/.phonecando/k/phone-tools/control/gen.mjs',
    ]);
  });

  it('seeds only the scripts for a kind with no config', () => {
    assert.equal(plan({ ...entry, manifest: {} }, null).length, KIT_SCRIPTS.length);
  });

  it('finds every file of our Cline kind', () => {
    const cline = loadManifests().find((e) => e.id === 'cline');
    const files = (dir) => readdirSync(dir, { recursive: true, withFileTypes: true }).filter((d) => d.isFile()).map((d) => relative(dir, join(d.parentPath, d.name)));
    const got = seedPlan({ entry: cline, configDir: '/root/.phonecando/cline', kitBin: '/root/.phonecando/bin', repo: REPO_ROOT, list: files });
    assert.ok(got.some((f) => f.to === '/root/.phonecando/cline/launch.sh'));
    assert.ok(got.some((f) => f.to === '/root/.phonecando/cline/phonecando-mcp.mjs'), 'a kind config keeps its .mjs');
  });
});
