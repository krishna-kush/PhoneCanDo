// The release's staged files and upload list, for a build run and for
// --upload-only.
//   node --test "scripts/release/**/*.test.mjs"
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { releaseAssets } from './assets.mjs';

const DIR = '/repo/dist/release/v0.2.0';
const PROOT = { version: '5.1.107.102', libs: {} };

test('proot ships: the GPL source tarball is uploaded after the APKs and latest.json', () => {
  const assets = releaseAssets({ dir: DIR, version: '0.2.0', proot: PROOT });
  assert.deepEqual(assets.uploads, [
    `${DIR}/phonecando-0.2.0-full-arm64.apk`,
    `${DIR}/phonecando-0.2.0-lite-arm64.apk`,
    `${DIR}/latest.json`,
    `${DIR}/phonecando-proot-5.1.107.102-source.tar.gz`,
  ]);
  assert.equal(assets.source, `${DIR}/phonecando-proot-5.1.107.102-source.tar.gz`);
});

test('upload-only: the same uploads, but only the APKs and latest.json must be staged already', () => {
  const assets = releaseAssets({ dir: DIR, version: '0.2.0', proot: PROOT });
  assert.deepEqual(assets.staged, [assets.full, assets.lite, assets.manifest]);
  assert.ok(assets.uploads.includes(assets.source), 'packed again and uploaded on --upload-only too');
});

test('no proot (--without-linux): no source tarball', () => {
  const assets = releaseAssets({ dir: DIR, version: '0.2.0', proot: null });
  assert.equal(assets.source, null);
  assert.deepEqual(assets.uploads, [assets.full, assets.lite, assets.manifest]);
});
