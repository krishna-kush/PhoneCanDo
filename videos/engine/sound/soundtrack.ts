// A film's whole soundtrack from its `Sound`: the score played onto its
// tracks, each track set to its loudness, pumped, sent to the echo and the
// room; the silences and tape stops cut in; the effects laid over the
// music, the music giving way under them; then mastered. Pure: it writes
// nothing (cli.ts does).

import { clockOf } from './clock.ts';
import { placeEffects } from './effects/place.ts';
import { integrated } from './master/loudness.ts';
import { clean, master } from './master/master.ts';
import { duckCurve } from './mix/duck.ts';
import { pump, pumpCurve } from './mix/pump.ts';
import { sends } from './mix/sends.ts';
import { silence } from './mix/silence.ts';
import { tapeStop } from './mix/tapestop.ts';
import { stageOf } from './score/play.ts';
import type { Sound } from './sound.ts';
import { scale, stereo, type Stereo } from './synth/stereo.ts';

/** Where the music sits before the effects join it, in LUFS. */
const MUSIC = -15;
/**
 * The platforms' loudness and the true-peak ceiling under it: low enough
 * that AAC's overshoot (about 2 dB on the hits) still stays under -1. A
 * film's `master` asks for another.
 */
export const TARGET = -14;
export const CEILING = -3.2;

export type Soundtrack = { music: Stereo; effects: Stereo; mix: Stereo; lufs: number; peak: number };

export function soundtrack(sound: Sound): Soundtrack {
  const clock = clockOf(sound.tempo);
  const { sampleOf } = clock;
  const n = sampleOf(sound.beats);
  const score = sound.music;
  const names = Object.keys(score.tracks);
  const stage = stageOf(clock, names, n);
  score.play(stage);
  const { tracks, pumps } = stage;

  for (const t of names) {
    const now = integrated(tracks[t]);
    if (Number.isFinite(now)) scale(tracks[t], 10 ** ((score.tracks[t].loudness - now) / 20));
  }
  const curve = pumpCurve(pumps, n);
  for (const t of names) {
    const depth = score.tracks[t].pump;
    if (depth) pump(tracks[t], curve, depth);
  }

  const music = stereo(n);
  const feeds = names.map((t) => ({ track: tracks[t], echo: score.tracks[t].echo, room: score.tracks[t].room }));
  const wet = sends(clock, feeds, score.cuts.map(sampleOf), n);
  for (const t of [...names.map((id) => tracks[id]), wet]) {
    for (let i = 0; i < n; i++) {
      music.l[i] += t.l[i];
      music.r[i] += t.r[i];
    }
  }
  clean(music);
  for (const s of score.stops) tapeStop(music, sampleOf(s.from), sampleOf(s.to) - sampleOf(s.from));
  for (const q of score.silences) silence(music, sampleOf(q.from), sampleOf(q.to));
  const now = integrated(music);
  if (Number.isFinite(now)) scale(music, 10 ** ((MUSIC - now) / 20));

  const effects = placeEffects(clock, sound.cues, score.chordAt, n);
  clean(effects);
  const duck = duckCurve(clock, sound.cues, effects, n);
  for (let i = 0; i < n; i++) {
    music.l[i] *= duck[i];
    music.r[i] *= duck[i];
  }

  const sum = stereo(n);
  for (let i = 0; i < n; i++) {
    sum.l[i] = music.l[i] + effects.l[i];
    sum.r[i] = music.r[i] + effects.r[i];
  }
  const m = master(sum, sound.master?.loudness ?? TARGET, sound.master?.ceiling ?? CEILING);
  return { music: scale(music, m.gain), effects: scale(effects, m.gain), mix: m.out, lufs: m.lufs, peak: m.peak };
}
