// What a section plays with: the tracks, the kicks that pump them, the
// span it plays over, and the moves every section makes.

import { BEAT } from '../../timeline/tempo.ts';
import { kick, type Kick } from '../drums/kick.ts';
import { sampleOf } from '../rate.ts';
import { addMono, addStereo, type Stereo } from '../synth/stereo.ts';
import type { Span } from './plan.ts';
import type { TrackId, Tracks } from './tracks.ts';

/** A kick the pumped tracks duck under, at a sample, [depth] 0 to 1. */
export type Pump = { at: number; depth: number };

export type Ctx = { tracks: Tracks; pumps: Pump[]; span: Span };

/** Every 16th in the span, as indexes on the video's 16th grid. */
export function steps(span: Span): number[] {
  const out: number[] = [];
  for (let s = Math.ceil(span.from * 4 - 1e-9); s < span.to * 4 - 1e-9; s++) out.push(s);
  return out;
}

/** A 16th, in seconds. */
export const STEP_S = BEAT / 4;

/** Plays [sound] on [track] at [beat], silent from the span's limit on. */
export function put(ctx: Ctx, track: TrackId, sound: Float32Array | Stereo, beat: number, gain = 1, pan = 0) {
  const at = sampleOf(beat);
  const limit = sampleOf(ctx.span.limit);
  if (sound instanceof Float32Array) addMono(ctx.tracks[track], sound, at, gain, pan, limit);
  else addStereo(ctx.tracks[track], sound, at, gain, pan, limit);
}

/** A kick at [beat] that the pumped tracks duck under. */
export function kickAt(ctx: Ctx, beat: number, vel: number, o: Kick = {}, pump = 1) {
  put(ctx, 'kick', kick({ seed: Math.round(beat * 4), ...o }), beat, vel);
  if (pump > 0) ctx.pumps.push({ at: sampleOf(beat), depth: pump * Math.min(1, vel) });
}

/** Where 16th [s] falls: its place in its bar (0 to 15), its bar and its beat. */
export const where = (s: number) => ({ pos: ((s % 16) + 16) % 16, bar: Math.floor(s / 16), beat: s / 4 });
