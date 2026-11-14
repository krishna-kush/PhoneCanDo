// Hush: "They make no sound." The narrator alone, very quiet, and nothing
// else; the first tap on the needle cuts him off, and the plan's silence
// runs from there to the drop.

import { MOMENTS } from '../../script/moments.ts';
import { narrator } from '../figures.ts';
import type { Note } from '../notes.ts';
import type { Span } from '../plan.ts';

const m = MOMENTS.song;

export function hush(_: Span): Note[] {
  return narrator(m.line, m.taps[0], 0.3);
}
