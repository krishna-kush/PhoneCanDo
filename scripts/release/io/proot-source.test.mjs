// proot-source.mjs over a fake bash and a temp workdir: no network, no pack.
//   node --test "scripts/release/**/*.test.mjs"
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { makeProotSource } from './proot-source.mjs';

const work = mkdtempSync(join(tmpdir(), 'release-proot-source-'));
after(() => rmSync(work, { recursive: true, force: true }));
const sha = (text) => createHash('sha256').update(text).digest('hex');

test('missingDownloads: what is absent or fails its pinned sha256', () => {
  mkdirSync(join(work, 'downloads'), { recursive: true });
  writeFileSync(join(work, 'downloads', 'proot-c0ffee.tar.gz'), 'proot');
  writeFileSync(join(work, 'downloads', 'talloc-2.5.0.tar.gz'), 'tampered');
  const pins = { PROOT_COMMIT: 'c0ffee', PROOT_SHA256: sha('proot'), TALLOC_VERSION: '2.5.0', TALLOC_SHA256: sha('talloc') };
  const source = makeProotSource({ root: '/repo', run: () => assert.fail('no bash') });
  assert.deepEqual(source.missingDownloads(work, pins), ['talloc-2.5.0.tar.gz']);
  writeFileSync(join(work, 'downloads', 'talloc-2.5.0.tar.gz'), 'talloc');
  assert.deepEqual(source.missingDownloads(work, pins), []);
});

test('pack: runs source-tarball.sh <workdir> <out> from the repo, throws on failure', () => {
  const calls = [];
  const ok = makeProotSource({ root: '/repo', run: (args) => (calls.push(args), { status: 0, stdout: '### proot\n', stderr: '' }) });
  assert.equal(ok.pack('/w', '/w/out/x.tar.gz'), '### proot\n');
  assert.deepEqual(calls, [['/repo/lre/proot/source-tarball.sh', '/w', '/w/out/x.tar.gz']]);
  const down = makeProotSource({ root: '/repo', run: () => ({ status: 1, stdout: '', stderr: 'fetch FAIL: no source gave talloc-2.5.0.tar.gz' }) });
  assert.throws(() => down.pack('/w', '/w/out/x.tar.gz'), /fetch FAIL/);
});
