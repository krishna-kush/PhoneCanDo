// Waveshapers: warmth, crunch and the soft corner a hot signal goes round.

/** [x] driven into tanh by [k], a full-scale input still at full scale. */
export const drive = (x: number, k: number) => Math.tanh(k * x) / Math.tanh(k);

/** [x] cut to [bits] bits, the grit of an old chip. */
export const crush = (x: number, bits: number) => {
  const q = 2 ** (bits - 1);
  return Math.round(x * q) / q;
};

/** Untouched below [knee], then bent smoothly so nothing passes 1. */
export function soft(x: number, knee: number): number {
  const a = Math.abs(x);
  if (a <= knee) return x;
  const room = 1 - knee;
  return Math.sign(x) * (knee + room * Math.tanh((a - knee) / room));
}
