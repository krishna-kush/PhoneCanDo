// Seeded chance: the backdrop's board, specks and units come out the same on
// every visit, so a cousin you clicked is still there next time.

/** A string to a number in [0, 1) (FNV-1a). */
export function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
}

/** A stream of numbers in [0, 1) from a seed (mulberry32). */
export function stream(seed: string): () => number {
  let a = Math.floor(hash(seed) * 4294967296);
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const pick = <T>(rand: () => number, list: readonly T[]): T => list[Math.floor(rand() * list.length)];

/** A cheap number in [0, 1) for three integers: for specks and stars drawn every frame. */
export function noise(a: number, b: number, c: number): number {
  const v = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453;
  return v - Math.floor(v);
}
