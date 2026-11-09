// check.mjs: exit code and output on our tree and on a broken one.
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';
import { main } from './check.mjs';

const roots = [];
after(() => roots.forEach((r) => rmSync(r, { recursive: true, force: true })));

function run(argv) {
  const out = [];
  const code = main(argv, { log: (line) => out.push(line) });
  return { code, out };
}

describe('check.mjs', () => {
  it('passes our tree', () => {
    const { code, out } = run([]);
    assert.equal(code, 0);
    assert.match(out.at(-1), /^agents: \d+ kind\(s\), \d+ runtime\(s\) OK \(.*native\/opencode.*runtimes\/node/);
  });

  it('fails a tree with problems and lists each one', () => {
    const root = mkdtempSync(join(tmpdir(), 'agents-check-'));
    roots.push(root);
    mkdirSync(join(root, 'agents/image/kit'), { recursive: true });
    writeFileSync(join(root, 'agents/image/kit/agent.json'), '{"schema": 2}');
    const { code, out } = run(['--root', root]);
    assert.equal(code, 1);
    assert.ok(out.some((l) => l.includes('agents/image/kit/agent.json /schema: const')), out.join('\n'));
    assert.match(out.at(-1), /^agents: \d+ problem\(s\) in 0 kind\(s\), 0 runtime\(s\)$/);
  });
});
