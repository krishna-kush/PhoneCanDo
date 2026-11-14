// What a score plays with: the film's clock, a buffer for each of its
// tracks, the kicks that pump them, the span being played, and the moves
// every section makes.

import type { Tempo } from '../../beats/tempo.ts';
import type { Clock } from '../clock.ts';
import { kick, type Kick } from '../instruments/drums/kick.ts';
import type { Pump } from '../mix/pump.ts';
import { addMono, addStereo, stereo, type Stereo } from '../synth/stereo.ts';
import type { Span } from './plan.ts';

/** What a score plays onto: the film's clock, its tracks by name, and the kicks the pumped tracks duck under. */
export type Stage<T extends string = string> = { clock: Clock; tracks: Record<T, Stereo>; pumps: Pump[] };

/** A stage, and the span of the plan being played on it. */
export type Ctx<T extends string = string, S extends Span = Span> = Stage<T> & { span: S };

/** An empty stage: each of [names] a silent track [n] samples long. */
export const stageOf = <T extends string>(clock: Clock, names: readonly T[], n: number): Stage<T> => ({
  clock,
  tracks: Object.fromEntries(names.map((t) => [t, stereo(n)])) as Record<T, Stereo>,
  pumps: [],
});

/** Every 16th in the span, as indexes on the film's 16th grid. */
export function steps(span: Pick<Span, 'from' | 'to'>): number[] {
  const out: number[] = [];
  for (let s = Math.ceil(span.from * 4 - 1e-9); s < span.to * 4 - 1e-9; s++) out.push(s);
  return out;
}

/** A 16th, in seconds. */
export const stepOf = (tempo: Tempo) => tempo.beat / 4;

/** Where 16th [s] falls: its place in its bar (0 to 15 in a bar of four), its bar and its beat. */
export function where(tempo: Tempo, s: number) {
  const per = tempo.bar * 4;
  return { pos: ((s % per) + per) % per, bar: Math.floor(s / per), beat: s / 4 };
}

/** Plays [sound] on [track] at [beat], silent from the span's limit on. */
export function put<T extends string>(ctx: Ctx<T>, track: NoInfer<T>, sound: Float32Array | Stereo, beat: number, gain = 1, pan = 0) {
  const at = ctx.clock.sampleOf(beat);
  const limit = ctx.clock.sampleOf(ctx.span.limit);
  if (sound instanceof Float32Array) addMono(ctx.tracks[track], sound, at, gain, pan, limit);
  else addStereo(ctx.tracks[track], sound, at, gain, pan, limit);
}

/** A kick at [beat] on the track named `kick`, which the pumped tracks duck under. */
export function kickAt(ctx: Ctx<'kick'>, beat: number, vel: number, o: Kick = {}, pump = 1) {
  put(ctx, 'kick', kick({ seed: Math.round(beat * 4), ...o }), beat, vel);
  if (pump > 0) ctx.pumps.push({ at: ctx.clock.sampleOf(beat), depth: pump * Math.min(1, vel) });
}
