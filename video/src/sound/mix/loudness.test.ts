import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SR } from '../rate.ts';
import { stereo } from '../synth/stereo.ts';
import { integrated, loudest } from './loudness.ts';
import { truePeak } from './truepeak.ts';

const sine = (f: number, amp: number, seconds: number) => {
  const s = stereo(Math.round(seconds * SR));
  for (let i = 0; i < s.l.length; i++) s.l[i] = s.r[i] = amp * Math.sin((2 * Math.PI * f * i) / SR);
  return s;
};

test('a full-scale 1 kHz sine in both sides reads 0 LUFS, as BS.1770 says', () => {
  assert.ok(Math.abs(integrated(sine(1000, 1, 5))) < 0.1);
});

test('half the level reads 6 dB down, and the loudest window agrees on a steady tone', () => {
  const s = sine(1000, 0.5, 5);
  assert.ok(Math.abs(integrated(s) + 6.02) < 0.1);
  assert.ok(Math.abs(loudest(s, 0.1) + 6.02) < 0.1);
});

test('silence has no loudness', () => {
  assert.equal(integrated(stereo(SR * 2)), -Infinity);
});

test('the true peak finds the crest between samples', () => {
  // A quarter of the sample rate, phased so every sample misses the crest by 45 degrees.
  const s = stereo(4800);
  for (let i = 0; i < s.l.length; i++) s.l[i] = s.r[i] = Math.sin((Math.PI / 2) * i + Math.PI / 4);
  const sampled = Math.max(...s.l.map(Math.abs));
  assert.ok(sampled < 0.72);
  assert.ok(truePeak(s) > 0.97);
});
