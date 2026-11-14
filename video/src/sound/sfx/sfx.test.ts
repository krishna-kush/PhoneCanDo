import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SFX, type Sfx } from '../../timeline/sfx.ts';
import { BEAT } from '../../timeline/tempo.ts';
import { CHORDS } from '../score/harmony.ts';
import { peakOf } from '../synth/stereo.ts';
import { made } from './place.ts';

const rms = (x: Float32Array) => Math.sqrt(x.reduce((s, v) => s + v * v, 0) / x.length);

for (const sfx of Object.keys(SFX) as Sfx[]) {
  test(`${sfx} renders finite, audible and under full scale`, () => {
    for (const seed of [0, 1, 4]) {
      const s = made(sfx, { pitch: 0, len: 2 * BEAT, seed, nth: seed, noise: 7 + seed, chord: CHORDS.Am });
      assert.ok(s.l.length > 0 && s.l.length === s.r.length);
      assert.ok([...s.l, ...s.r].every(Number.isFinite), 'every sample is a number');
      assert.ok(Math.max(rms(s.l), rms(s.r)) > 1e-4, 'it makes a sound');
      assert.ok(peakOf(s) < 1, `peak ${peakOf(s).toFixed(3)} stays under full scale`);
    }
  });
}

test('a riser ends where its length says', () => {
  const len = 3.5 * BEAT;
  const s = made('riser', { pitch: 0, len, seed: 0, nth: 0, noise: 1, chord: CHORDS.Am });
  assert.equal(s.l.length, Math.round(len * 48000));
});
