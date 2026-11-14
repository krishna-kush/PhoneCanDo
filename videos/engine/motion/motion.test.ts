// The motion helpers' edges: eases pinned at both ends, a stretch of
// beats clamped, keys held outside their span, a hop back at rest, a
// spring that settles, the same noise every time.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { inBack, inCubic, inOutCubic, inOutQuad, inQuad, linear, outBack, outBounce, outCubic, outExpo, outQuad } from './ease.ts';
import { glance } from './eyes.ts';
import { keys, place } from './keys.ts';
import { hash, noise } from './noise.ts';
import { ring, spring } from './spring.ts';
import { both, hop, REST } from './squash.ts';
import { hit, seg } from './tween.ts';

test('every ease starts at 0 and ends at 1', () => {
  for (const e of [linear, inQuad, outQuad, inOutQuad, inCubic, outCubic, inOutCubic, outExpo, outBack(), inBack(), outBounce()]) {
    assert.ok(Math.abs(e(0)) < 1e-9);
    assert.ok(Math.abs(e(1) - 1) < 1e-9);
  }
});

test('a bounce never goes past the floor it lands on', () => {
  const bounce = outBounce();
  for (let t = 0; t <= 1; t += 0.01) assert.ok(bounce(t) <= 1 + 1e-9);
});

test('seg clamps outside its stretch and handles an instant', () => {
  assert.equal(seg(-1, 0, 2), 0);
  assert.equal(seg(3, 0, 2), 1);
  assert.equal(seg(1, 0, 2), 0.5);
  assert.equal(seg(1, 1, 1), 1);
  assert.equal(hit(0.5, 1), 0);
  assert.equal(hit(1, 1), 1);
});

test('keys hold their ends and ease between', () => {
  const track = [[2, 10], [4, 20], [6, 0, inQuad]] as const;
  assert.equal(keys(0, track), 10);
  assert.equal(keys(3, track), 15);
  assert.equal(keys(5, track), 15);
  assert.equal(keys(9, track), 0);
  assert.deepEqual(place(1, [[0, 0, 0], [2, 4, 8]]), { x: 2, y: 4 });
});

test('a hop is at rest before its crouch and long after landing', () => {
  assert.deepEqual(hop(0, 1, 0.5, 0.4), REST);
  assert.deepEqual(hop(5, 1, 0.5, 0.4), REST);
  assert.ok(hop(1.25, 1, 0.5, 0.4).lift > 0.39);
  assert.deepEqual(both(REST, REST), REST);
});

test('a spring starts at 0 and settles on 1; a ring dies away', () => {
  assert.equal(spring(0), 0);
  assert.ok(Math.abs(spring(5) - 1) < 1e-3);
  assert.equal(ring(0), 0);
  assert.ok(Math.abs(ring(8)) < 1e-3);
});

test('a glance holds its last look and snaps to the next', () => {
  const looks = [[1, -1, 0], [2, 1, 0]] as const;
  assert.deepEqual(glance(0, looks), [0, 0]);
  assert.deepEqual(glance(1.5, looks), [-1, 0]);
  assert.deepEqual(glance(3, looks), [1, 0]);
});

test('noise is the same every render and stays in range', () => {
  assert.equal(hash(3, 4), hash(3, 4));
  for (let x = 0; x < 20; x += 0.37) assert.ok(Math.abs(noise(x, 2)) <= 1);
});
