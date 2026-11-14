// The acoustic voices' promises: each is finite, audible and under full
// scale; the reed, the marimba and the plucked string sound the note they
// are asked for; the reed speaks slowly, the mallet and the pluck die
// fast; the whistle glides from its first note to its second.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SR } from '../../rate.ts';
import { hz } from '../../synth/pitch.ts';
import { marimba } from './marimba.ts';
import { pizz } from './pizz.ts';
import { reed } from './reed.ts';
import { whistle } from './whistle.ts';

const rms = (x: Float32Array, from = 0, to = x.length) => {
  let e = 0;
  for (let i = from; i < to; i++) e += x[i] * x[i];
  return Math.sqrt(e / Math.max(1, to - from));
};

const peak = (x: Float32Array) => x.reduce((p, v) => Math.max(p, Math.abs(v)), 0);

/** The pitch of [x] near [expect] Hz, from the lag it best repeats at, [from] seconds in. */
function pitchOf(x: Float32Array, expect: number, from: number): number {
  const start = Math.round(from * SR);
  const period = SR / expect;
  const span = Math.min(x.length - start - Math.ceil(period * 1.2), Math.round(period * 12));
  const score = (lag: number) => {
    let s = 0;
    for (let i = start; i < start + span; i++) s += x[i] * x[i + lag];
    return s;
  };
  let best = Math.round(period);
  for (let lag = Math.floor(period * 0.9); lag <= Math.ceil(period * 1.1); lag++) if (score(lag) > score(best)) best = lag;
  // The peak between samples, from the parabola through its neighbours.
  const [a, b, c] = [score(best - 1), score(best), score(best + 1)];
  return SR / (best + (a - c) / (2 * (a - 2 * b + c)));
}

/** The frequency [x] crosses zero at between [from] and [to] seconds. */
function crossings(x: Float32Array, from: number, to: number): number {
  let count = 0;
  for (let i = Math.round(from * SR) + 1; i < Math.round(to * SR); i++) if (x[i - 1] < 0 !== x[i] < 0) count++;
  return count / 2 / (to - from);
}

const VOICES = {
  reed: (midi: number) => reed({ midi, len: 0.5 }),
  marimba: (midi: number) => marimba({ midi }),
  pizz: (midi: number) => pizz({ midi }),
};

for (const [name, voice] of Object.entries(VOICES)) {
  test(`the ${name} is finite, audible, under full scale and in tune, low and high`, () => {
    for (const midi of [45, 57, 69, 76, 88]) {
      const x = voice(midi);
      assert.ok(x.every(Number.isFinite), 'every sample is a number');
      assert.ok(rms(x) > 1e-3, 'it makes a sound');
      assert.ok(peak(x) < 1, `peak ${peak(x).toFixed(3)} stays under full scale`);
      const off = Math.abs(1200 * Math.log2(pitchOf(x, hz(midi), 0.03) / hz(midi)));
      assert.ok(off < 12, `note ${midi} is ${off.toFixed(1)} cents off`);
    }
  });
}

test('the reed speaks slowly and holds its note; the mallet and the pluck die fast', () => {
  const r = reed({ midi: 45, len: 0.6 });
  assert.ok(rms(r, 0, Math.round(0.015 * SR)) < 0.5 * rms(r, Math.round(0.2 * SR), Math.round(0.5 * SR)), 'the reed starts soft');
  assert.ok(rms(r, Math.round(0.4 * SR), Math.round(0.6 * SR)) > 0.7 * rms(r, Math.round(0.2 * SR), Math.round(0.4 * SR)), 'and holds');
  for (const x of [marimba({ midi: 69 }), pizz({ midi: 69 })]) {
    assert.ok(rms(x, Math.round(0.4 * SR), Math.round(0.5 * SR)) < 0.2 * rms(x, 0, Math.round(0.1 * SR)), 'down to a fifth in under half a second');
  }
});

test('a bar is damped and a string stopped where its length says', () => {
  for (const x of [marimba({ midi: 57, len: 0.1 }), pizz({ midi: 57, len: 0.1 })]) {
    assert.ok(x.length <= Math.round(0.14 * SR), 'no longer than its length and a short stop');
    assert.ok(Math.abs(x[x.length - 1]) < 1e-3, 'faded out at its end');
  }
});

test('the whistle glides from its first note to its second, with a breath on top', () => {
  const dry = whistle({ from: 84, to: 72, len: 0.5, breath: 0 });
  assert.ok(dry.every(Number.isFinite));
  assert.ok(peak(dry) < 1);
  assert.ok(Math.abs(crossings(dry, 0.01, 0.04) / hz(84) - 1) < 0.04, 'it starts on its first note');
  assert.ok(Math.abs(crossings(dry, 0.44, 0.5) / hz(72) - 1) < 0.04, 'it ends on its second');
  const up = whistle({ from: 72, to: 84, len: 0.5, breath: 0 });
  assert.ok(crossings(up, 0.44, 0.5) > 1.8 * crossings(up, 0.01, 0.04), 'and rises an octave the other way');
  const airy = whistle({ from: 84, to: 72, len: 0.5 });
  let differ = 0;
  for (let i = 0; i < dry.length; i++) differ = Math.max(differ, Math.abs(airy[i] - dry[i]));
  assert.ok(differ > 1e-3, 'the breath is there');
});
