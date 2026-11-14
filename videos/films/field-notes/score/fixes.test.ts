// The fixes' promises: the root climbs A minor a step a shot, each ta-da
// is the fifth then the octave over it, each zip is four rising notes; a
// zip starts on its strike, the ta-da lands on its write, and the whistle
// falls from the strike and reaches the top again on the write.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GLIDE } from '../../../engine/sound/instruments/voices/whistle.ts';
import { MOMENTS } from '../script/moments.ts';
import { FALL, FIXES, fixOf, RISE, TA, tadaOf, ZIP, type Fix, type Fixed } from './fixes.ts';
import { degree, MINOR } from './themes.ts';

const SHOTS = Object.keys(FIXES) as Fixed[];

test('the root climbs A minor a step a shot, each fix a little bolder than the last', () => {
  assert.deepEqual(SHOTS, ['lights', 'crew', 'tools', 'gate', 'chores']);
  SHOTS.forEach((shot, k) => assert.equal(FIXES[shot].root, degree(MINOR, 69, k), shot));
  SHOTS.forEach((shot, k) => assert.ok(k === 0 || FIXES[shot].level > FIXES[SHOTS[k - 1]].level, shot));
  assert.deepEqual(tadaOf(69), [76, 81], 'a fifth, then the octave: E5 to A5 over A');
});

test('a zip starts on the strike and rises; the ta-da lands on the write, on marimba and bell', () => {
  for (const shot of SHOTS) {
    const fix: Fix = FIXES[shot];
    if (!fix.zip) continue;
    const { strike, write } = MOMENTS[shot];
    const notes = fixOf(shot);
    const zip = notes.filter((n) => n.track === 'pizz');
    assert.deepEqual(zip.map((n) => [n.at, n.midi]), fix.zip.map((midi, k) => [strike + k * ZIP, midi]), `${shot}: four fast notes from the strike`);
    assert.ok(zip.every((n, k) => k === 0 || n.midi > zip[k - 1].midi), `${shot}: rising`);
    const [fifth, octave] = tadaOf(fix.root);
    assert.ok(fix.zip[3] < fifth, `${shot}: the zip runs up to the ta-da`);
    for (const track of ['marimba', 'bell'] as const) {
      assert.deepEqual(notes.filter((n) => n.track === track).map((n) => [n.at, n.midi]), [[write - TA, fifth], [write, octave]], `${shot}: ${track}`);
    }
  }
});

test('the workshop’s fix is the whistle: down an octave from the strike, back up to land on the write', () => {
  const { strike, write } = MOMENTS.tools;
  const { root } = FIXES.tools;
  const [fall, rise] = fixOf('tools');
  assert.deepEqual([fall.track, fall.at, fall.from, fall.midi, fall.len], ['whistle', strike, root + 12, root, FALL]);
  assert.ok(fall.at + fall.len <= rise.at, 'the fall is over before the rise starts');
  assert.deepEqual([rise.track, rise.from, rise.midi], ['whistle', root, root + 12]);
  assert.equal(rise.at, write - RISE);
  assert.ok(Math.abs(rise.at + rise.len * GLIDE - write) < 1e-9, 'its glide ends on the write');
});
