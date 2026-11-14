// Moments on a film's beat line as a command line names them: `b12.5` is
// a beat, `gate` a shot's first beat, `gate+2` two beats into it, and a
// bare number is seconds. Pure.

import { beatsOf, type Tempo } from '../beats/tempo.ts';
import type { Shot, Timeline } from '../beats/timeline.ts';

export type BeatLine = { tempo: Tempo; line: Timeline<Shot> };

/** [moment] in beats from the film's start. */
export function beatOf(moment: string, { tempo, line }: BeatLine): number {
  const m = moment.trim();
  if (/^b-?\d+(\.\d+)?$/.test(m)) return Number(m.slice(1));
  if (/^-?\d+(\.\d+)?$/.test(m)) return beatsOf(tempo, Number(m));
  const [, id, plus] = /^([a-z][a-z0-9-]*)(?:\+(\d+(?:\.\d+)?))?$/i.exec(m) ?? [];
  if (id && line.shots.some((s) => s.id === id)) return line.startOf(id) + Number(plus ?? 0);
  throw new Error(`"${moment}" is no moment: write b12.5 (a beat), a number of seconds, or a shot (${line.shots.map((s) => s.id).join(', ')}), with +beats after it if you like.`);
}

/** A shot's whole stretch, in beats. */
export function shotSpan(id: string, { line }: BeatLine): { from: number; to: number } {
  const shot = line.shots.find((s) => s.id === id);
  if (!shot) throw new Error(`No shot called ${id}; there are ${line.shots.map((s) => s.id).join(', ')}.`);
  const from = line.startOf(id);
  return { from, to: from + shot.beats };
}

/** A beat as a file name's part: 12.5 → b12_5. */
export const beatLabel = (beat: number) => `b${Number(beat.toFixed(2))}`.replace('.', '_');
