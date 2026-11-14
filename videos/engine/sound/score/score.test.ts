// What a score builds on: a plan whose rests silence the music, spans
// that walk their chords from an anchor, a minor chord brightened to its
// relative major, and notes that never sound past their span's limit.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { tempoOf } from '../../beats/tempo.ts';
import { clockOf } from '../clock.ts';
import { peakOf } from '../synth/stereo.ts';
import { brightOf, type Chord } from './chord.ts';
import { planOf, STOP } from './plan.ts';
import { kickAt, put, stageOf, stepOf, steps, where } from './play.ts';
import { chordAt, chordIn } from './progression.ts';

const Am: Chord = { name: 'Am', root: 45, tones: [57, 60, 64], major: false };
const Em: Chord = { name: 'Em', root: 40, tones: [55, 59, 64], major: false };
const F: Chord = { name: 'F', root: 41, tones: [57, 60, 65], major: true };

test('a gap and a stop silence the music up to the next section', () => {
  const plan = planOf(
    [
      { at: 0, section: 'drop' },
      { at: 6, section: 'stop' },
      { at: 8, section: 'drop' },
      { at: 11.5, section: 'gap' },
      { at: 12, section: 'finale' },
    ],
    16,
  );
  assert.deepEqual(plan.silences, [
    { from: 6 + STOP, to: 8 },
    { from: 11.5, to: 12 },
  ]);
  assert.deepEqual(plan.stops, [{ from: 6, to: 6 + STOP }]);
  assert.deepEqual(plan.cuts, [6 + STOP, 8, 11.5, 12]);
  assert.deepEqual(plan.spans.map((s) => s.kind), ['drop', 'drop', 'finale']);
  assert.deepEqual(plan.spans.map((s) => s.prev), [undefined, 'stop', 'gap']);
  // The drop before the stop plays on into it, for the tape to wind down on.
  assert.equal(plan.spans[0].to, 6 + STOP);
  assert.equal(plan.spans[0].limit, 6 + STOP);
  assert.equal(plan.spans[1].limit, 11.5);
  assert.equal(plan.spans[2].limit, 16);
});

test('a span walks its chords a bar each from its anchor, and a beat finds the chord under it', () => {
  const spans = [
    { from: 0, prog: [Am, F], anchor: 0 },
    { from: 8, prog: [Em], anchor: 2 },
  ];
  assert.deepEqual([0, 1, 2, 3, -1].map((bar) => chordIn(spans[0], bar).name), ['Am', 'F', 'Am', 'F', 'F']);
  const t = tempoOf(120);
  assert.deepEqual([0, 3.99, 4, 7.99, 8, 99].map((beat) => chordAt(t, spans, beat).name), ['Am', 'Am', 'F', 'F', 'Em', 'Em']);
  // Three beats to a bar: the chord changes a beat sooner.
  assert.equal(chordAt(tempoOf(120, 3), spans, 3).name, 'F');
});

test('a minor chord brightens to its relative major, voiced close; a major one stays', () => {
  assert.deepEqual(brightOf(Am), { name: 'C', root: 48, tones: [55, 60, 64], major: true });
  assert.deepEqual(brightOf(Em), { name: 'G', root: 43, tones: [55, 59, 62], major: true });
  assert.equal(brightOf(F), F);
});

test('the 16th grid follows the tempo', () => {
  assert.deepEqual(steps({ from: 1, to: 2 }), [4, 5, 6, 7]);
  assert.deepEqual(where(tempoOf(120), 13), { pos: 13, bar: 0, beat: 3.25 });
  assert.deepEqual(where(tempoOf(120, 3), 13), { pos: 1, bar: 1, beat: 3.25 });
  assert.equal(stepOf(tempoOf(120)), 0.125);
});

test('a sound lands on its beat and is silent from its span’s limit; a kick is noted for the pump', () => {
  const clock = clockOf(tempoOf(120));
  const { sampleOf } = clock;
  const stage = stageOf(clock, ['kick', 'pad'], sampleOf(4));
  const ctx = { ...stage, span: { kind: 'any', from: 0, to: 4, limit: 2 } };
  put(ctx, 'pad', new Float32Array(sampleOf(2)).fill(1), 1);
  const { l } = stage.tracks.pad;
  assert.equal(l[sampleOf(1) - 1], 0);
  assert.ok(l[sampleOf(1)] > 0.99);
  assert.ok(l[sampleOf(2) - 1] > 0, 'fading into the limit');
  assert.equal(peakOf({ l: l.subarray(sampleOf(2)), r: stage.tracks.pad.r.subarray(sampleOf(2)) }), 0);
  kickAt(ctx, 0.5, 0.8);
  assert.deepEqual(stage.pumps, [{ at: sampleOf(0.5), depth: 0.8 }]);
  assert.ok(peakOf(stage.tracks.kick) > 0);
});
