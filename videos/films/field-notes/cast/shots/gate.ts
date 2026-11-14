// Gate: a line of them marches along the landing into the locked gate and
// piles up behind its first. They turn and look at us until the
// fingerprint opens it, cheer, and most go on through to the glass.

import { MOMENTS } from '../../script/moments.ts';
import { groundOf, LANDING, WALL } from '../../world/plan.ts';
import { memberIn } from '../cast.ts';
import type { Script } from '../script.ts';

/** The line, front to back. The last two stay on the landing. */
export const MARCHERS = ['plain', 'cowboy', 'chef', 'wizard', 'dj', 'top-hat', 'cap', 'professor'] as const;
export const STAY = 2;

/** How far the line walks to the gate. */
const RUN = 60;

export function gate(s: Script) {
  const m = MOMENTS.gate;
  const ground = groundOf('landing');
  MARCHERS.forEach((design, k) => {
    const member = memberIn(design);
    const stop = LANDING.stop - k * LANDING.spacing;
    // In line and waiting before the camera gets here.
    s.go(member, { at: m.march - 3, x: stop - RUN, y: ground });
    s.go(member, { at: m.march, x: stop, y: ground, len: m.bonks[k] - m.march, how: 'walk', steady: true });
    s.act(member, { kind: 'bump', at: m.bonks[k], dir: 1 });
    s.act(member, { kind: 'gaze', from: m.look, to: m.armed, x: 0, y: 0, eyes: 'wide' });
    const goes = k < MARCHERS.length - STAY;
    const leaves = m.through + k * 0.06;
    s.act(member, { kind: 'hops', from: m.cheer, to: goes ? leaves : m.through + 1.2, every: 0.5, height: 0.5, phase: k * 0.07 });
    // Through the gate and out of sight behind the wall, on the way up to the glass.
    if (goes) s.go(member, { at: leaves, x: WALL.right + 12 + k * 6, y: ground, len: 1, how: 'walk' });
  });
}
