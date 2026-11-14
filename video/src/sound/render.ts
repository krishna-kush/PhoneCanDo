// The whole soundtrack from the timeline: the score played onto its
// tracks, each track set to its loudness, pumped, sent to the echo and the
// room; the silences and tape stops cut in; the effects laid over the
// music, the music giving way under them; then mastered. Pure: it writes
// nothing (cli.ts does).

import { sectionsOf, soundsOf } from '../timeline/cues.ts';
import { TOTAL } from '../timeline/scenes.ts';
import type { Facts } from '../timeline/script/types.ts';
import { duckCurve } from './mix/duck.ts';
import { effects } from './mix/fx.ts';
import { integrated } from './mix/loudness.ts';
import { clean, master } from './mix/master.ts';
import { pump, pumpCurve } from './mix/pump.ts';
import { silence } from './mix/silence.ts';
import { tapeStop } from './mix/tapestop.ts';
import { sampleOf } from './rate.ts';
import { arrange } from './score/arrange.ts';
import { planOf, STOP } from './score/plan.ts';
import { LOUDNESS, PUMP, TRACKS } from './score/tracks.ts';
import { placeSfx } from './sfx/place.ts';
import { scale, stereo, type Stereo } from './synth/stereo.ts';

/** Where the music sits before the effects join it, in LUFS. */
const MUSIC = -15;
/**
 * The platforms' loudness and the true-peak ceiling under it: low enough
 * that AAC's overshoot (about 2 dB on the hits) still stays under -1.
 */
export const TARGET = -14;
export const CEILING = -3.2;

export type Soundtrack = { music: Stereo; sfx: Stereo; mix: Stereo; lufs: number; peak: number };

export function render(facts: Facts): Soundtrack {
  const n = sampleOf(TOTAL);
  const plan = planOf(sectionsOf(), TOTAL);
  const { tracks, pumps } = arrange(plan, n);

  for (const t of TRACKS) {
    const now = integrated(tracks[t]);
    if (Number.isFinite(now)) scale(tracks[t], 10 ** ((LOUDNESS[t] - now) / 20));
  }
  const curve = pumpCurve(pumps, n);
  for (const t of TRACKS) {
    const depth = PUMP[t];
    if (depth) pump(tracks[t], curve, depth);
  }

  const music = stereo(n);
  const wet = effects(tracks, plan.cuts.map(sampleOf), n);
  for (const t of [...TRACKS.map((id) => tracks[id]), wet]) {
    for (let i = 0; i < n; i++) {
      music.l[i] += t.l[i];
      music.r[i] += t.r[i];
    }
  }
  clean(music);
  for (const at of plan.stops) tapeStop(music, sampleOf(at), sampleOf(at + STOP) - sampleOf(at));
  for (const q of plan.silences) silence(music, sampleOf(q.from), sampleOf(q.to));
  scale(music, 10 ** ((MUSIC - integrated(music)) / 20));

  const cues = soundsOf(facts);
  const sfx = placeSfx(cues, plan, n);
  clean(sfx);
  const duck = duckCurve(cues, sfx, n);
  for (let i = 0; i < n; i++) {
    music.l[i] *= duck[i];
    music.r[i] *= duck[i];
  }

  const sum = stereo(n);
  for (let i = 0; i < n; i++) {
    sum.l[i] = music.l[i] + sfx.l[i];
    sum.r[i] = music.r[i] + sfx.r[i];
  }
  const m = master(sum, TARGET, CEILING);
  return { music: scale(music, m.gain), sfx: scale(sfx, m.gain), mix: m.out, lufs: m.lufs, peak: m.peak };
}
