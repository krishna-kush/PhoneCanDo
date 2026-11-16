import type { MemoryLevel } from '../../../../engine/memory';
import type { MapInk } from '../../logic/ramMap';

// The palette role each kind of block is drawn in, on the strip, in its key
// and on a row's share bar: models amber (the big eaters), agents in ink,
// the one next up red, everything else a quiet grey. Free is bare paper.
export const INK = {
  model: 'secondary',
  agent: 'fg',
  next: 'primary',
  other: 'lineStrong',
} as const satisfies Record<MapInk, string>;

// The hatching over the zone where we start to sweat: quiet while all is
// calm, amber when snug, red when nearly gone.
export const ZONE_INK = {
  ok: 'lineStrong',
  warn: 'secondary',
  critical: 'primary',
} as const satisfies Record<MemoryLevel, string>;

// The share used, in words beside the free memory: the level's ink.
export const LEVEL_INK = {
  ok: 'dim',
  warn: 'secondaryInk',
  critical: 'primary',
} as const satisfies Record<MemoryLevel, string>;

/** A fraction of the phone's memory as a CSS length along the strip. */
export const pct = (fraction: number) => `${fraction * 100}%` as const;
