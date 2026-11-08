// drift.mjs: how far our proot pin is behind upstream, as lines to print.
//   node --test "scripts/release/**/*.test.mjs"
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { prootDrift } from './drift.mjs';

const PINS = {
  PROOT_REPO: 'termux/proot',
  PROOT_COMMIT: '52d65a4dc140ca554d241a1438ddd4f6b00c9813',
  PROOT_VERSION: '5.1.107.102',
};
const COMPARE = 'https://github.com/termux/proot/compare/52d65a4dc140ca554d241a1438ddd4f6b00c9813...master';

test('the branch head: nothing to say', () => {
  assert.equal(prootDrift(PINS, { branch: 'master', newer: 0, offBranch: 0 }), null);
});

test('behind: the count, what we build, and where to read the changes', () => {
  const drift = prootDrift(PINS, { branch: 'master', newer: 7, offBranch: 0 });
  assert.equal(drift.newer, 7);
  assert.deepEqual(drift.lines, [
    'proot is 7 change(s) behind termux/proot master: we build 5.1.107.102 (52d65a4dc140).',
    `What changed: ${COMPARE}`,
  ]);
});

test('a pin the branch dropped (force-push) is said too', () => {
  const drift = prootDrift(PINS, { branch: 'master', newer: 2, offBranch: 1 });
  assert.equal(drift.lines.length, 3);
  assert.match(drift.lines[1], /^1 change\(s\) in our pin are no longer on termux\/proot master\.$/);
  assert.equal(prootDrift(PINS, { branch: 'master', newer: 0, offBranch: 1 }).newer, 0);
});
