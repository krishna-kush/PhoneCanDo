// How A-07 leaves a floor, the same way every time: it walks to the hatch,
// the hatch opens under it, it drops a whole floor and lands on the same
// spot of the deck below, where the next chapter starts. Every deck has its
// hatch in the same place, a shaft of trapdoors down the right margin.

import { arch, span } from '../../species/motion';
import { PITCH } from '../../world/building';
import { at, walk, type Pose, type Spot } from './pose';

/** Seconds from setting off for the hatch to standing on the floor below. */
export const EXIT = 2.6;
/** A hatch's side, world units. */
export const HATCH = 42;

const WALK = 1.1;
const OPEN = 1.45;
const DROP = 2.2;

/** Where the hatch is in a margin [margin] px wide: near the front of the deck. */
export const hatchSpot = (margin: number): Spot => ({ out: Math.round(Math.min(80, Math.max(28, margin * 0.2))), z: 72 });

/** A-07 [s] seconds after setting off from [from] for the hatch at [hatch]. */
export function leaving(from: Pose, hatch: Spot, s: number): Pose {
  const kit = from.kit;
  if (s < WALK) return walk(from, hatch, s / WALK, { kit });
  if (s < OPEN) {
    const k = span(s, WALK, OPEN);
    return at(hatch, { eyes: 'wide', gaze: [0, 1], sx: 1 + 0.1 * k, sy: 1 - 0.1 * k, kit });
  }
  if (s < DROP) {
    const k = span(s, OPEN, DROP);
    return at(hatch, { up: -PITCH * k * k, sx: 0.9, sy: 1.14, eyes: 'wide', gaze: [0, -1], kit });
  }
  const k = span(s, DROP, EXIT);
  return at(hatch, { up: -PITCH, sx: 1 + 0.26 * arch(k), sy: 1 - 0.26 * arch(k), eyes: k < 0.6 ? 'shut' : 'dot', kit });
}

/** How open a floor's hatch is [s] seconds after A-07 set off for it: 0 shut, 1 open. */
export const hatchOpen = (s: number) => span(s, WALK - 0.1, OPEN - 0.05) * (1 - span(s, DROP + 0.1, EXIT));
