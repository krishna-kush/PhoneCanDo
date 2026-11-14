// The film's sound as a whole: every effect sits exactly on its moment,
// the silences are the effects' too, and the soundtrack the engine makes
// is as long as the film, at the platforms' loudness, under the ceiling,
// silent where it should be and loudest at the drop.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clockOf } from '../../engine/sound/clock.ts';
import { EFFECTS, type EffectName } from '../../engine/sound/effects/names.ts';
import { integrated } from '../../engine/sound/master/loudness.ts';
import { db, truePeak } from '../../engine/sound/master/truepeak.ts';
import { SR } from '../../engine/sound/rate.ts';
import { CEILING, soundtrack, TARGET } from '../../engine/sound/soundtrack.ts';
import type { Stereo } from '../../engine/sound/synth/stereo.ts';
import { LINE, START } from './beats.ts';
import { RUNNING } from './score/sections/tools.ts';
import { MOMENTS } from './script/moments.ts';
import { sound } from './sound.ts';

const m = MOMENTS;

test('the film is whole bars, and every cue is a known effect inside it', () => {
  assert.equal(sound.beats % sound.tempo.bar, 0);
  for (const c of sound.cues) {
    assert.ok(c.sound in EFFECTS, c.sound);
    assert.ok(c.at >= 0 && c.at < sound.beats, `${c.sound} at ${c.at} is outside the film`);
  }
});

test('every effect sits exactly on its moment, and there is no other', () => {
  const last = m.chores.done[m.chores.done.length - 1];
  const written: Record<string, number[]> = {
    chirp: [m.lights.wake, m.end.blink],
    boing: [m.lights.hop, m.end.peek],
    tick: [...m.lights.lamps, ...m.dawn.out],
    pop: [...m.crew.pops, m.dawn.grab],
    lock: [m.tools.breaker, m.dawn.shut],
    type: [...m.tools.typing],
    land: [...m.gate.bonks],
    scan: [m.gate.scan[0]],
    stamp: [m.gate.armed, ...m.chores.done],
    unlock: [m.gate.armed],
    riser: [m.tools.breaker, m.gate.through, last],
    tap: [...m.song.taps],
    impact: [m.song.drop],
    ding: [m.tools.write, m.song.write, ...m.dawn.bell, m.dawn.right, m.end.ding],
    notify: [m.dawn.card],
    sunrise: [m.dawn.card],
    slam: [m.end.button],
  };
  const placed: Record<string, number[]> = {};
  for (const c of sound.cues) (placed[c.sound] ??= []).push(c.at);
  for (const times of Object.values(placed)) times.sort((a, b) => a - b);
  assert.deepEqual(placed, written);
});

test('the effects that take a length end where the picture says', () => {
  const ends = (name: EffectName) => sound.cues.filter((c) => c.sound === name).map((c) => c.at + (c.len ?? 0));
  assert.deepEqual(ends('scan'), [m.gate.scan[1]], 'the scan lasts as long as the press');
  assert.deepEqual(ends('riser'), [RUNNING, START.chores, m.song.line], 'each riser ends on what it rises to');
});

test('no effect for the stare at the gate; from the narrator’s line to the drop, only the taps', () => {
  assert.deepEqual(sound.cues.filter((c) => c.at >= m.gate.look && c.at < m.gate.scan[0]), []);
  assert.deepEqual(sound.cues.filter((c) => c.at >= m.song.line && c.at < m.song.drop).map((c) => [c.sound, c.at]), m.song.taps.map((at) => ['tap', at]));
});

test('the whole soundtrack: 48 s, no NaN, at the platforms’ loudness, under the ceiling, silent where it should be, loudest at the drop', () => {
  const track = soundtrack(sound);
  const { sampleOf } = clockOf(sound.tempo);
  const n = sampleOf(sound.beats);
  assert.equal(n / SR, 48, '48.00 s');
  for (const s of [track.music, track.effects, track.mix]) {
    assert.equal(s.l.length, n);
    assert.equal(s.r.length, n);
    assert.ok(s.l.every(Number.isFinite) && s.r.every(Number.isFinite), 'every sample is a number');
  }
  assert.ok(Math.abs(integrated(track.mix) - TARGET) < 0.5, `${integrated(track.mix).toFixed(2)} LUFS is within 0.5 LU of ${TARGET}`);
  assert.ok(db(truePeak(track.mix)) <= CEILING + 0.005, `true peak ${db(truePeak(track.mix)).toFixed(2)} dBTP is under ${CEILING}`);

  const peak = (s: Stereo, from: number, to: number) => {
    let top = 0;
    for (let i = sampleOf(from); i < sampleOf(to); i++) top = Math.max(top, Math.abs(s.l[i]), Math.abs(s.r[i]));
    return top;
  };
  /** The level over [from, to) beats, in dBFS. */
  const level = (s: Stereo, from: number, to: number) => {
    let e = 0;
    for (let i = sampleOf(from); i < sampleOf(to); i++) e += s.l[i] ** 2 + s.r[i] ** 2;
    return 10 * Math.log10(e / (2 * (sampleOf(to) - sampleOf(from))) + 1e-12);
  };

  for (const q of sound.music.silences) assert.equal(peak(track.music, q.from, q.to), 0, `the music is silent from beat ${q.from} to ${q.to}`);
  // The stare is silent in the mix too: nothing but the last thud's dying filter tail, 60 dB down and gone in a moment.
  assert.ok(peak(track.mix, m.gate.look, m.gate.scan[0]) < 1e-3, 'the stare is silent');
  assert.ok(level(track.mix, m.gate.look, m.gate.scan[0]) < -80, 'the stare is silent');
  // Before the drop the narrator is alone and very quiet, then only the taps.
  assert.ok(peak(track.music, m.song.line, m.song.taps[0]) > 0, 'the narrator is there');
  assert.ok(level(track.mix, m.song.line, m.song.taps[0]) < level(track.mix, m.song.drop, m.dawn.bell[0]) - 15, 'very quiet');
  assert.ok(peak(track.effects, m.song.taps[0], m.song.drop) > 0, 'the taps are there');

  const drop = level(track.mix, m.song.drop, m.dawn.bell[0]);
  for (const shot of LINE.shots) {
    if (shot.id === 'song') continue;
    const here = level(track.mix, START[shot.id], START[shot.id] + shot.beats);
    assert.ok(here < drop - 2, `${shot.id} at ${here.toFixed(1)} dB stays under the drop's ${drop.toFixed(1)}`);
  }
  for (const night of LINE.shots.filter((s) => s.id === 'lights' || s.id === 'crew')) {
    assert.ok(level(track.mix, START[night.id], START[night.id] + night.beats) < drop - 6, `${night.id} is quiet, so the drop is huge`);
  }
  // Faded out by the end.
  assert.ok(Math.abs(track.mix.l[n - 1]) < 1e-4 && Math.abs(track.mix.r[n - 1]) < 1e-4);
});
