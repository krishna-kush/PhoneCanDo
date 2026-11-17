// What each mood draws on the body, so a change draws both moods' parts and
// fades each one between them, and none ever pops in or out.
// Pure (zero RN imports); partWeight and weighted are worklets.
import type { Mood } from '../mood';

export type Part = 'eyes' | 'pupils' | 'smile' | 'z' | 'drop' | 'query' | 'hearts';

const ORDER: readonly Part[] = ['eyes', 'pupils', 'smile', 'z', 'drop', 'query', 'hearts'];

/** Each mood's parts: open eyes with pupils, shut ones under a "z", a frown's "?", a sweat drop, a smile's brackets and its hearts. */
export const PARTS: Record<Mood, readonly Part[]> = {
  awake: ['eyes', 'pupils'],
  busy: ['eyes', 'pupils'],
  asleep: ['eyes', 'z'],
  oops: ['eyes', 'pupils', 'query'],
  sweaty: ['eyes', 'pupils', 'drop'],
  happy: ['smile', 'hearts'],
};

/** Every part in [lists], once each, in one order. */
export function unionOf(...lists: (readonly Part[])[]): Part[] {
  return ORDER.filter((p) => lists.some((l) => l.includes(p)));
}

/** A part's weight on each side of a change from [from] to [to]: 1 drawn, 0 not. */
export type Sides = readonly [from: number, to: number];

export function sidesOf(part: Part, from: Mood, to: Mood): Sides {
  return [PARTS[from].includes(part) ? 1 : 0, PARTS[to].includes(part) ? 1 : 0];
}

/**
 * A part's weight with the hand-over at [over], in a change whose hand-over
 * rests at [at] (0 or 1) as it starts and runs to the other end, so it never
 * has to jump back first: its from side at the start, its to side at the end.
 */
export function partWeight(sides: Sides, over: number, at: number): number {
  'worklet';
  return sides[0] + (sides[1] - sides[0]) * Math.abs(over - at);
}

/** [style] at [weight]: its own opacity (1 if it has none) times the weight, so every live part says its opacity on every frame. */
export function weighted<S extends object>(style: S, weight: number): S & { opacity: number } {
  'worklet';
  const own = (style as { opacity?: number }).opacity;
  return { ...style, opacity: (own ?? 1) * weight };
}
