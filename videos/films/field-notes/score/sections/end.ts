// End: home, in C major. The narrator's theme whole at last, paced by the
// screen as it forms: C and G, F on the mark, D over G a beat before the
// button, C on the button. Over it the hook's C bar on marimba and bell
// together, soft drums from the mark. The button's chord is left to ring
// under a plucked note for the peek and a tiny bell for the blink.

import { MOMENTS } from '../../script/moments.ts';
import { hook } from '../figures.ts';
import { CHORDS } from '../harmony.ts';
import { KIT } from '../kit.ts';
import { chord, grid, note, posOf, type Note } from '../notes.ts';
import type { Span } from '../plan.ts';
import { HOME } from '../themes.ts';

const m = MOMENTS.end;

/** The beat G sounds on, before the button's C. */
export const BEFORE = m.button - 1;

/** Where each note of the narrator's theme falls: on the line, the mark, the beat before the button and the button, and halfway between. */
export const PACE = [m.line, (m.line + m.mark) / 2, m.mark, (m.mark + BEFORE) / 2, BEFORE, m.button] as const;

/** How long the narrator holds his last note, in beats. */
const HELD = 3;
/** The chord stops ringing this long before the last ding, in beats. */
const HUSH = 0.5;

/** The plucked note for the peek and the tiny bell for the blink: G5, C7. */
export const PEEK = 79;
export const BLINK = 96;

export function end(_: Span): Note[] {
  const { C, F, G } = CHORDS;
  // F is voiced without its top F: the narrator's E passes under it, a seventh over the bass, and would grind against it.
  const walk = [
    { at: m.line, root: C.root, tones: [C.root, ...C.tones], to: m.mark },
    { at: m.mark, root: F.root, tones: [F.root, ...F.tones.slice(0, 2)], to: BEFORE },
    { at: BEFORE, root: G.root, tones: [G.root, ...G.tones], to: m.button },
  ];
  const ring = m.ding - HUSH - m.button;
  return [
    ...HOME.map((midi, i) => note('narrator', PACE[i], midi, i + 1 < PACE.length ? PACE[i + 1] - PACE[i] : HELD, 0.75)),
    ...walk.flatMap((w) => [...chord('pad', w.at, w.tones, w.to - w.at, 0.4), note('bass', w.at, w.root, w.to - w.at, 0.25)]),
    ...hook('marimba', 'C', m.line, { len: 0.3, vel: 0.6 }),
    ...hook('bell', 'C', m.line, { len: 0.5, vel: 0.5 }),

    ...grid(m.mark, m.button, 0.5).flatMap((at) => [
      note('hats', at, KIT.hat, 0.25, posOf(at) % 4 === 0 ? 0.24 : 0.18, { pan: 0.25 }),
      ...(posOf(at) % 4 === 0 ? [note('kick', at, KIT.kick, 1, 0.45)] : []),
    ]),
    note('drums', BEFORE, KIT.clap, 0.25, 0.3),

    ...chord('stab', m.button, [C.root, ...C.tones, C.tones[0] + 12, C.tones[1] + 12], ring, 0.4),
    ...chord('pad', m.button, [C.root, ...C.tones], ring, 0.35),
    note('bass', m.button, C.root, 2, 0.35),
    note('crash', m.button, KIT.crash, 3, 0.3),
    note('marimba', m.button, 72, 1, 0.65),
    note('bell', m.button, 84, 2, 0.6),

    note('pizz', m.peek, PEEK, 0.5, 0.6, { pan: 0.2 }),
    note('bell', m.blink, BLINK, 0.5, 0.35, { pan: 0.2 }),
  ];
}
