// The motion helpers' edges: eases pinned at both ends, a stretch of
// beats clamped, a hop back at rest, the same noise every time.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { glance, hop } from '../picture/unit/moves.ts';
import { inCubic, inOutCubic, inQuad, linear, outBack, outCubic, outExpo } from './ease.ts';
import { hash, noise } from './noise.ts';
import { hit, seg } from './tween.ts';

test('every ease starts at 0 and ends at 1', () => {
  for (const e of [linear, inQuad, inCubic, outCubic, inOutCubic, outExpo, outBack()]) {
    assert.ok(Math.abs(e(0)) < 1e-9);
    assert.ok(Math.abs(e(1) - 1) < 1e-9);
  }
});

test('seg clamps outside its stretch and handles an instant', () => {
  assert.equal(seg(-1, 0, 2), 0);
  assert.equal(seg(3, 0, 2), 1);
  assert.equal(seg(1, 0, 2), 0.5);
  assert.equal(seg(1, 1, 1), 1);
  assert.equal(hit(0.5, 1), 0);
  assert.equal(hit(1, 1), 1);
});

test('a hop is at rest before its crouch and long after landing', () => {
  assert.deepEqual(hop(0, 1, 0.5, 0.4), { lift: 0, sx: 1, sy: 1 });
  assert.deepEqual(hop(5, 1, 0.5, 0.4), { lift: 0, sx: 1, sy: 1 });
  assert.ok(hop(1.25, 1, 0.5, 0.4).lift > 0.39);
});

test('a glance holds its last look and snaps to the next', () => {
  const keys = [[1, -1, 0], [2, 1, 0]] as const;
  assert.deepEqual(glance(0, keys), [0, 0]);
  assert.deepEqual(glance(1.5, keys), [-1, 0]);
  assert.deepEqual(glance(3, keys), [1, 0]);
});

test('noise is the same every render and stays in range', () => {
  assert.equal(hash(3, 4), hash(3, 4));
  for (let x = 0; x < 20; x += 0.37) assert.ok(Math.abs(noise(x, 2)) <= 1);
});
