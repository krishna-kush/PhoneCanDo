// Seeded randomness, so every render of the soundtrack is the same file:
// mulberry32 for the numbers, FNV-1a to turn names into seeds.

export type Rand = () => number;

/** Numbers in [0, 1) from [seed]. */
export function rand(seed: number): Rand {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A seed from words and numbers, so each voice gets noise of its own. */
export function seedOf(...parts: readonly (string | number)[]): number {
  let h = 0x811c9dc5;
  for (const ch of parts.join('|')) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
