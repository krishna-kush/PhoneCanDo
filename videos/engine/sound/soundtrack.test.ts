// The pipeline's promises, on a small film made here: sixteen beats of a
// kick and a pad with a tape stop and a gap in them, and a few effects.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { tempoOf } from '../beats/tempo.ts';
import { clockOf } from './clock.ts';
import { pad } from './instruments/voices/pad.ts';
import { integrated } from './master/loudness.ts';
import { db, truePeak } from './master/truepeak.ts';
import type { Chord } from './score/chord.ts';
import { planOf } from './score/plan.ts';
import { kickAt, put, steps, where } from './score/play.ts';
import type { Music, Sound } from './sound.ts';
import { CEILING, soundtrack, TARGET } from './soundtrack.ts';
import { peakOf, type Stereo } from './synth/stereo.ts';

const tempo = tempoOf(120);
const BEATS = 16;
const Am: Chord = { name: 'Am', root: 45, tones: [57, 60, 64], major: false };

const plan = planOf(
  [
    { at: 0, section: 'groove' },
    { at: 6, section: 'stop' },
    { at: 8, section: 'groove' },
    { at: 11.5, section: 'gap' },
    { at: 12, section: 'groove' },
  ],
  BEATS,
);

const music: Music<'kick' | 'pad'> = {
  tracks: { kick: { loudness: -14 }, pad: { loudness: -18, pump: 0.6, echo: 0.2, room: 0.2 } },
  play: (stage) => {
    for (const span of plan.spans) {
      const ctx = { ...stage, span };
      for (const s of steps(span)) {
        const { pos, beat } = where(tempo, s);
        if (pos % 4 === 0) kickAt(ctx, beat, 1);
        if (pos === 0) put(ctx, 'pad', pad({ notes: Am.tones, len: stage.clock.secondsOf(4) }), beat);
      }
    }
  },
  silences: plan.silences,
  stops: plan.stops,
  cuts: plan.cuts,
  chordAt: () => Am,
};

const sound: Sound = {
  tempo,
  beats: BEATS,
  cues: [
    { at: 4, sound: 'impact' },
    { at: 9, sound: 'pop', pan: 0.5 },
    { at: 12, sound: 'sunrise', gain: 0.8 },
  ],
  music,
};

const { sampleOf } = clockOf(tempo);
const finite = (s: Stereo) => [...s.l, ...s.r].every(Number.isFinite);

test('a soundtrack: as long as the film, at the platforms’ loudness, under the ceiling, silent where the plan says', () => {
  const track = soundtrack(sound);
  const n = sampleOf(BEATS);
  for (const s of [track.music, track.effects, track.mix]) {
    assert.equal(s.l.length, n);
    assert.equal(s.r.length, n);
    assert.ok(finite(s));
  }
  assert.ok(Math.abs(integrated(track.mix) - TARGET) < 0.3, 'about -14 LUFS');
  assert.ok(db(truePeak(track.mix)) <= CEILING + 0.05, 'true peak under the ceiling');
  for (const q of plan.silences) {
    const from = sampleOf(q.from);
    const to = sampleOf(q.to);
    assert.equal(peakOf({ l: track.music.l.subarray(from, to), r: track.music.r.subarray(from, to) }), 0, `the music is silent from beat ${q.from} to ${q.to}`);
  }
  assert.ok(peakOf(track.music) > 0 && peakOf(track.effects) > 0);
  // Faded out by the end.
  assert.ok(Math.abs(track.mix.l[n - 1]) < 1e-4 && Math.abs(track.mix.r[n - 1]) < 1e-4);
});

test('a film can ask for another loudness and ceiling', () => {
  const track = soundtrack({ ...sound, master: { loudness: -20, ceiling: -6 } });
  assert.ok(Math.abs(integrated(track.mix) + 20) < 0.3, 'about -20 LUFS');
  assert.ok(db(truePeak(track.mix)) <= -6 + 0.05, 'true peak under -6 dBTP');
});

test('a film with no music still gets its effects', () => {
  const track = soundtrack({ ...sound, music: { tracks: {}, play: () => {}, silences: [], stops: [], cuts: [], chordAt: () => Am } });
  assert.ok(finite(track.mix));
  assert.equal(peakOf(track.music), 0);
  assert.ok(peakOf(track.mix) > 0);
});
