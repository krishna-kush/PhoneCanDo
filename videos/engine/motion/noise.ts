// Randomness that comes out the same every render: a hash for a number
// from a seed, smooth 1D noise for wobble, and a shake for impacts. Pure.

/** A number in [0, 1) from the integers [a] and [b], the same every time. */
export function hash(a: number, b = 0): number {
  let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Smooth noise in [-1, 1] along [x], one bump an integer, per [seed]. */
export function noise(x: number, seed = 0): number {
  const i = Math.floor(x);
  const f = x - i;
  const s = f * f * (3 - 2 * f);
  const a = hash(i, seed) * 2 - 1;
  const b = hash(i + 1, seed) * 2 - 1;
  return a + (b - a) * s;
}

/** A shake [amount] strong, rattling [rate] times a beat: x, y and a turn. */
export function shake(t: number, amount: number, rate = 9, seed = 7): { x: number; y: number; r: number } {
  if (amount <= 0) return { x: 0, y: 0, r: 0 };
  return { x: noise(t * rate, seed) * amount, y: noise(t * rate, seed + 1) * amount, r: noise(t * rate, seed + 2) * amount * 0.08 };
}
