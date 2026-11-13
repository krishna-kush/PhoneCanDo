// What tells one unit of the A-series from another. A-01 and A-02 are the
// page's own (components/Mascot.astro); the backdrop's units are their
// cousins: the same body, the brand mark's two blocks, in a seeded mix of
// size, pose, which ink is in front, eyes and what each one wears
// (data/wear.ts), which changes its outline so it reads even small.

import logo from '../../../../../theme/logo.json';
import { OTHER_WEAR, wear, type Wear } from '../../../data/wear';
import { pick, stream } from '../seed';

export type Pose = 'square' | 'wide' | 'tall';
export type Eyes = 'dot' | 'wide' | 'sleepy' | 'shut' | 'happy';
/** Which way it is turned: its face to us, side on, or its back to us. */
export type Facing = 'front' | 'side' | 'back';

export type Look = {
  /** The block's short side, world units. */
  size: number;
  pose: Pose;
  /** The amber block in front, as the loader's swap frames have it. */
  swap: boolean;
  eyes: Eyes;
  wear: Wear;
  /** Its serial, A-03 up: A-01 and A-02 are taken. */
  serial: string;
};

const [, wideFrame, , , tallFrame] = logo.loader.poses;
export const WIDE = wideFrame.w;
export const TALL = tallFrame.h;
/** The amber block's offset, as a share of the size. */
export const SHADOW = logo.shadow.ratio;

const POSES: Pose[] = ['square', 'square', 'wide', 'tall'];
const WEAR: Wear[] = [wear({}), ...OTHER_WEAR];

/** A cousin from a seed: the same seed gives the same unit on every visit. */
export function cousin(seed: string, set: Partial<Look> = {}): Look {
  const rand = stream(seed);
  const size = set.size ?? 17 + Math.round(rand() * 17);
  const pose = set.pose ?? pick(rand, POSES);
  const swap = set.swap ?? rand() < 0.3;
  const worn = set.wear ?? pick(rand, WEAR);
  const serial = set.serial ?? `A-${String(3 + Math.floor(rand() * 97)).padStart(2, '0')}`;
  return { size, pose, swap, eyes: set.eyes ?? 'dot', wear: worn, serial };
}
