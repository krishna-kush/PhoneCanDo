// list.mjs: the CI matrix and the plain listing.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { lines, main, matrix } from './list.mjs';

function run(argv) {
  const out = [];
  const err = [];
  const code = main(argv, { log: (l) => out.push(l), error: (l) => err.push(l) });
  return { code, out, err };
}

const image = { id: 'claude-code', type: 'image', manifest: { channels: ['full', 'lite'], version: '1' } };
const native = {
  id: 'opencode',
  type: 'native',
  manifest: { prefix: 'oc', channels: ['full'], version: '2', build: { toolchains: ['bun', 'zig', 'ndk'] } },
};

describe('list.mjs', () => {
  it('builds a matrix row per kind', () => {
    assert.deepEqual(matrix([native, image]), {
      include: [
        { id: 'opencode', type: 'native', prefix: 'oc', toolchains: 'bun,zig,ndk' },
        { id: 'claude-code', type: 'image', prefix: '', toolchains: '' },
      ],
    });
  });

  it('prints one tab-separated line per kind', () => {
    assert.deepEqual(lines([native, image]), ['opencode\tnative\toc\tfull\t2', 'claude-code\timage\t-\tfull,lite\t1']);
  });

  it('prints our native matrix', () => {
    const { code, out } = run(['--type', 'native', '--matrix']);
    assert.equal(code, 0);
    const { include } = JSON.parse(out.join(''));
    assert.deepEqual(include.find((r) => r.id === 'opencode'), {
      id: 'opencode',
      type: 'native',
      prefix: 'oc',
      toolchains: 'bun,zig,ndk',
    });
  });

  it('keeps only the kinds with a models block for the local-model check', () => {
    const { code, out } = run(['--models', '--matrix']);
    assert.equal(code, 0);
    const { include } = JSON.parse(out.join(''));
    assert.ok(include.length > 0 && include.some((r) => r.id === 'opencode'));
    assert.ok(!include.some((r) => r.id === 'gemini-cli'), 'gemini-cli takes no endpoint');
  });

  it('rejects an unknown type or argument', () => {
    assert.equal(run(['--type', 'cloud']).code, 2);
    assert.equal(run(['--json']).code, 2);
  });
});
