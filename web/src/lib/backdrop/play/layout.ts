// Who lies where in the playground when the page opens, by the part of the
// page beside each floor: in stacks, from the bottom up, so one good throw
// can knock a stack down and wake it all. Each floor's are clear of its
// chute and fixture: the dock's apps lie in its squares, a seesaw's sleeper
// waits on its launching end, and the flashlight lies high up the page so
// you can carry it down to the tunnel's dark.

import { SHADOW, cousin } from '../species/look';
import { floorY } from '../world/building';
import type { Fixture } from './fixtures/kinds';
import { COUSIN_DESIGN, isCousin, type ToyKind } from './kinds';
import { SIZE, type Toy } from './toys';

/** A stack: its kinds from the bottom up, at a share of the way across the margin. */
type Stack = { at: number; kinds: ToyKind[] };

const LAYOUT: Record<string, Stack[]> = {
  hero: [
    { at: 0.12, kinds: ['clock'] },
    { at: 0.5, kinds: ['messages', 'notes'] },
  ],
  demos: [
    { at: 0.7, kinds: ['music'] },
    { at: 0.95, kinds: ['maps'] },
  ],
  models: [{ at: 0.1, kinds: ['headphones', 'flashlight'] }],
  linux: [{ at: 0.5, kinds: ['hardhat', 'clock'] }],
  crew: [{ at: 0.22, kinds: ['cap'] }],
  gate: [{ at: 0.6, kinds: ['tophat', 'settings'] }],
  install: [
    { at: 0.12, kinds: ['music'] },
    { at: 0.48, kinds: ['maps', 'notes'] },
  ],
  source: [
    { at: 0.55, kinds: ['messages'] },
    { at: 0.92, kinds: ['cap'] },
  ],
  faq: [{ at: 0.15, kinds: ['settings', 'notes', 'headphones'] }],
};

/** A floor whose part isn't above: one app, clear of its chute. */
const ANY: Stack[] = [{ at: 0.5, kinds: ['notes'] }];

/** The size a cousin is drawn at, so with its shadow it is SIZE across, as an app is. */
const COUSIN = SIZE / (1 + SHADOW);

/** Everyone for a building whose parts are [keys], with [fixtures] on its floors: asleep where they lie; nobody on the last floor. */
export function makeToys(keys: string[], fixtures: (Fixture | null)[]): Toy[] {
  const toys: Toy[] = [];
  keys.slice(0, -1).forEach((key, i) => {
    const stacks = LAYOUT[key] ?? (fixtures[i] ? [] : ANY);
    for (const { at, kinds } of stacks) {
      kinds.forEach((kind, k) => {
        const n = toys.length;
        const name = `toy:${kind}:${n}`;
        toys.push({
          name,
          kind,
          look: isCousin(kind) ? cousin(name, { size: COUSIN, shape: 'square', design: COUSIN_DESIGN[kind] }) : null,
          d: NaN,
          start: at,
          // Stacked: each stands on the one under it.
          y: floorY(i) - k * SIZE,
          vx: 0,
          vy: 0,
          awake: false,
          held: false,
          chute: -1,
          up: false,
          hole: NaN,
          grounded: true,
          shift: 0,
          squash: 0,
          squashV: 0,
          walked: 0,
          spin: 0,
          energy: 0,
          beat: 0,
          bounced: 9,
          cool: 0,
          dug: null,
          dock: -1,
          spark: false,
          lit: 0,
          hat: false,
          dig: -1,
          climbing: false,
          box: null,
        });
      });
    }
  });
  return toys;
}
