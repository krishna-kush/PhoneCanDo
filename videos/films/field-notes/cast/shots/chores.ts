// Chores: the ones who came through the gate walk in along the glass, four
// to an app room each. Each does its chore with a hop as its stamp lands.

import { START } from '../../beats.ts';
import { MOMENTS } from '../../script/moments.ts';
import { GLASS, groundOf, WALL } from '../../world/plan.ts';
import { memberIn } from '../cast.ts';
import type { Script } from '../script.ts';
import { MARCHERS, STAY } from './gate.ts';

/** Who takes which app room, left to right. */
export const AT_WINDOW = ['plain', 'cowboy', 'chef', 'wizard'] as const;

export function chores(s: Script) {
  const m = MOMENTS.chores;
  const ground = groundOf('glass');
  const arrive = START.chores - 0.05;
  const spots: Record<string, number> = { dj: GLASS.deck, 'top-hat': GLASS.hat };
  AT_WINDOW.forEach((design, i) => (spots[design] = GLASS.windows[i]));

  MARCHERS.slice(0, MARCHERS.length - STAY).forEach((design, k) => {
    const member = memberIn(design);
    // Up from the landing behind the wall, then in along the glass.
    s.go(member, { at: arrive, x: WALL.right + 12 + k * 6, y: ground });
    s.trip(member, arrive, spots[design], ground, 'walk', 95);
  });
  AT_WINDOW.forEach((design, i) => {
    const member = memberIn(design);
    s.act(member, { kind: 'gaze', from: m.done[i] - 0.9, to: m.done[i] - 0.3, x: 0, y: -0.9 });
    s.go(member, { at: m.done[i] - 0.5, x: GLASS.windows[i], y: ground, len: 0.5, how: 'hop' });
  });
}
