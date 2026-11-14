// The effects' promises: every name has a sound that is finite, audible
// and under full scale, and cues land where and in the order they say.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Cue } from '../../beats/cue.ts';
import { tempoOf } from '../../beats/tempo.ts';
import { clockOf } from '../clock.ts';
import { SR } from '../rate.ts';
import type { Chord } from '../score/chord.ts';
import { peakOf } from '../synth/stereo.ts';
import { EFFECTS, type EffectName } from './names.ts';
import { made, placeEffects } from './place.ts';

const Am: Chord = { name: 'Am', root: 45, tones: [57, 60, 64], major: false };

const rms = (x: Float32Array) => Math.sqrt(x.reduce((s, v) => s + v * v, 0) / x.length);

for (const name of Object.keys(EFFECTS) as EffectName[]) {
  test(`${name} renders finite, audible and under full scale`, () => {
    for (const seed of [0, 1, 4]) {
      const s = made(name, { pitch: 0, len: 1, seed, nth: seed, noise: 7 + seed, chord: Am });
      assert.ok(s.l.length > 0 && s.l.length === s.r.length);
      assert.ok([...s.l, ...s.r].every(Number.isFinite), 'every sample is a number');
      assert.ok(Math.max(rms(s.l), rms(s.r)) > 1e-4, 'it makes a sound');
      assert.ok(peakOf(s) < 1, `peak ${peakOf(s).toFixed(3)} stays under full scale`);
    }
  });
}

test('a riser ends where its length says', () => {
  const len = 1.5;
  const s = made('riser', { pitch: 0, len, seed: 0, nth: 0, noise: 1, chord: Am });
  assert.equal(s.l.length, Math.round(len * SR));
});

test('cues land at their beats in time order, however a film lists them', () => {
  const clock = clockOf(tempoOf(120));
  const n = clock.sampleOf(4);
  const cues: Cue<EffectName>[] = [
    { at: 2, sound: 'clock' },
    { at: 1, sound: 'clock' },
    { at: 3, sound: 'pop', pan: -1 },
  ];
  const bus = placeEffects(clock, cues, () => Am, n);
  assert.equal(bus.l.length, n);
  assert.equal(peakOf({ l: bus.l.subarray(0, clock.sampleOf(1)), r: bus.r.subarray(0, clock.sampleOf(1)) }), 0, 'nothing before the first cue');
  assert.ok(Math.abs(bus.l[clock.sampleOf(1) + 8]) > 0, 'the first tick is on its beat');
  assert.equal(rms(bus.r.subarray(clock.sampleOf(3))), 0, 'a sound panned hard left leaves the right empty');
  const again = placeEffects(clock, [...cues].reverse(), () => Am, n);
  assert.deepEqual(again, bus);
});
