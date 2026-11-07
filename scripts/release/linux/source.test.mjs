// proot's GPL source tarball: names, downloads, and what a fresh pack does
// next to a staged copy.
//   node --test "scripts/release/**/*.test.mjs"
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { sourceDecision, sourceDownloads, sourceTarballName } from './source.mjs';

const NAME = 'phonecando-proot-5.1.107.102-source.tar.gz';
const packed = (c, size = 3_000_000) => ({ sha256: c.repeat(64), size });

test('name and downloads follow pins.env', () => {
  assert.equal(sourceTarballName('5.1.107.102'), NAME);
  const pins = { PROOT_COMMIT: '52d65a4d', PROOT_SHA256: 'a'.repeat(64), TALLOC_VERSION: '2.5.0', TALLOC_SHA256: 'b'.repeat(64) };
  assert.deepEqual(sourceDownloads(pins), [
    { name: 'proot-52d65a4d.tar.gz', sha256: 'a'.repeat(64) },
    { name: 'talloc-2.5.0.tar.gz', sha256: 'b'.repeat(64) },
  ]);
});

test('nothing staged yet: the fresh pack is staged', () => {
  const decision = sourceDecision(null, packed('a'), NAME);
  assert.equal(decision.action, 'stage');
  assert.match(decision.message, new RegExp(`^${NAME}: packed, sha256 a{64}`));
});

test('staged copy with the same bytes: kept (the pack is deterministic)', () => {
  const decision = sourceDecision(packed('a'), packed('a'), NAME);
  assert.equal(decision.action, 'keep');
  assert.match(decision.message, /same bytes as the staged copy/);
});

test('staged copy with other bytes: refused, never replaced', () => {
  for (const staged of [packed('b'), packed('a', 1)]) {
    const decision = sourceDecision(staged, packed('a'), NAME);
    assert.equal(decision.action, 'refuse');
    assert.match(decision.message, /differs from the staged copy/);
  }
});
