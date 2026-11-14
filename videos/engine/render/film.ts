// What a film is to the engine: its name, its tempo and shots on the beat
// line, the frame sizes it is made in, and its picture. A film's folder
// (films/<id>/) exports one from film.tsx, and its beat line (TEMPO, LINE)
// from beats.ts for the commands.

import type { ComponentType } from 'react';
import type { Tempo } from '../beats/tempo.ts';
import type { Shot, Timeline } from '../beats/timeline.ts';
import type { FormatId } from '../stage/formats.ts';

export type Film = {
  /** Its folder in films/, and the start of each of its compositions' ids. */
  id: string;
  tempo: Tempo;
  /** Its shots in running order; its length is the line's. */
  line: Timeline<Shot>;
  fps: number;
  /** The frame sizes it is made in, the main one first. */
  formats: readonly FormatId[];
  /** Draws the frame at the clock's beat (useBeat()). */
  Picture: ComponentType;
  /** Whether it has a soundtrack: films/<id>/sound.ts, made by `pnpm sound <id>`. */
  sound: boolean;
};

/** The composition a film is rendered from in one format: field-notes-16x9. */
export const compositionId = (film: string, format: FormatId) => `${film}-${format}`;

/** Where a film's mix is, under public/. */
export const mixFile = (film: string) => `${film}/mix.wav`;
