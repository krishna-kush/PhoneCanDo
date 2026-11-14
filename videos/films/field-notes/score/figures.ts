// Figures more than one section plays: the narrator's theme cut off where
// the action says, a bar of the hook at any speed, the night's pad, tick
// and tiptoe, and a snare roll that tightens toward a hit.

import { DRONE } from './harmony.ts';
import { KIT } from './kit.ts';
import { grid, note, posOf, type Note } from './notes.ts';
import { HOOK, NARRATOR, type Bar } from './themes.ts';
import type { TrackId } from './tracks.ts';

/** The narrator's theme from [line], cut off at [until]: no note starts from there on, and the one sounding stops. */
export function narrator(line: number, until = Infinity, vel = 0.8): Note[] {
  return NARRATOR.filter(([at]) => line + at < until - 1e-9).map(([at, midi, len]) => note('narrator', line + at, midi, Math.min(len, until - line - at), vel));
}

/**
 * A bar of the hook on [track] from [at], each 16th taking [step] beats
 * (a quarter of a beat in time, an eighth at double speed, a half for the
 * music box). [until] cuts it off; [take] keeps only its first notes.
 */
export function hook(track: TrackId, bar: Bar, at: number, o: { step?: number; len?: number; vel?: number; until?: number; take?: number } = {}): Note[] {
  const { step = 0.25, len = 0.2, vel = 0.8, until = Infinity, take = Infinity } = o;
  return HOOK[bar]
    .slice(0, take)
    .map(([s, midi]) => note(track, at + s * step, midi, len, vel))
    .filter((n) => n.at < until - 1e-9);
}

/** The night's pad: the bare A and E, struck again softly on each bar line in [from, to). */
export function drone(from: number, to: number, vel = 0.4): Note[] {
  const starts = [from, ...grid(from, to, 4).filter((b) => b > from + 1e-9)];
  return starts.flatMap((at, i) => DRONE.map((midi) => note('pad', at, midi, (starts[i + 1] ?? to) - at, vel)));
}

/** The night's clock: a woodblock tick on beats 2 and 4, in [from, to). */
export function ticks(from: number, to: number, vel = 0.3): Note[] {
  return grid(from, to, 1)
    .filter((b) => posOf(b) === 4 || posOf(b) === 12)
    .map((b) => note('drums', b, KIT.rim, 0.25, vel, { pan: posOf(b) === 4 ? -0.25 : 0.25 }));
}

/**
 * The tiptoe in [from, to): a plucked A2 on beat 1 and E2 on beat 3, a hat
 * tick on every offbeat. The bass stops at [bassTo], for a line that takes
 * over from it.
 */
export function tiptoe(from: number, to: number, bassTo = to): Note[] {
  const bass = grid(from, Math.min(to, bassTo), 2).map((b) => note('pizz', b, posOf(b) === 0 ? 45 : 40, 0.5, 0.6));
  const hats = grid(from, to, 0.5)
    .filter((b) => posOf(b) % 4 === 2)
    .map((b) => note('hats', b, KIT.hat, 0.25, 0.3, { pan: 0.3 }));
  return [...bass, ...hats];
}

/**
 * A snare roll over [from, to): 8ths, then 16ths, then 32nds, louder as it
 * goes. [split] is where it moves up, as shares of the way through.
 */
export function roll(from: number, to: number, split: readonly [number, number] = [0.5, 0.75], top = 1): Note[] {
  const out: Note[] = [];
  for (const beat of grid(from, to, 0.125)) {
    const u = (beat - from) / (to - from);
    const every = u < split[0] ? 4 : u < split[1] ? 2 : 1;
    if (Math.round(beat * 8) % every) continue;
    out.push(note('drums', beat, KIT.snare, 0.25, top * (0.22 + 0.78 * u ** 1.5)));
  }
  return out;
}
