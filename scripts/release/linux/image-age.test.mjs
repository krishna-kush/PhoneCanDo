// image-age.mjs: the Default image's age from its version, as lines to print.
//   node --test "scripts/release/**/*.test.mjs"
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { imageAge, REPUBLISH } from './image-age.mjs';

const at = (iso) => new Date(iso);

test('days since the Debian snapshot the version is named after', () => {
  const age = imageAge('20261107-9de7e565', at('2026-11-30T15:00:00Z'));
  assert.equal(age.days, 23);
  assert.deepEqual(age.lines.slice(0, 2), [
    'Default image 20261107-9de7e565: Debian packages from 2026-11-07, 23 day(s) old.',
    `For newer packages, publish a fresh one: ${REPUBLISH}`,
  ]);
  assert.match(age.lines[2], /\.\/manage image lock <run-id>, commit lock\.json/);
});

test('the same day is 0 days; a clock behind the snapshot never goes negative', () => {
  assert.equal(imageAge('20261107-9de7e565', at('2026-11-07T23:59:00Z')).days, 0);
  assert.equal(imageAge('20261107-9de7e565', at('2026-11-01T00:00:00Z')).days, 0);
});

test('the republish run builds fresh inputs and publishes', () => {
  assert.match(REPUBLISH, /-f publish=true -f fresh=true$/);
});

test('a version without a date: null', () => {
  assert.equal(imageAge('local', at('2026-11-30T00:00:00Z')), null);
  assert.equal(imageAge(undefined, at('2026-11-30T00:00:00Z')), null);
});
