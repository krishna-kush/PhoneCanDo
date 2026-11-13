// Picking a look at random: a design nobody here wears yet while there is
// one, then a look nobody here has, so no two agents look alike for as long
// as that can last.

import { SHAPES } from './body.ts';
import { DESIGNS } from './designs.ts';
import { lookKey, type Look } from './look.ts';

/** How often the amber block comes out in front. */
const SWAP = 0.3;

const pick = <T>(rand: () => number, list: readonly T[]): T => list[Math.min(list.length - 1, Math.floor(rand() * list.length))];

/** Every look there is: each design in each shape, either ink in front. */
export function allLooks(): Look[] {
  return DESIGNS.flatMap((d) => SHAPES.flatMap((shape) => [false, true].map((swap) => ({ design: d.id, shape, swap }))));
}

/** A look for a newcomer among [taken], from [rand] (0 to 1, as Math.random). */
export function pickLook(taken: readonly Look[], rand: () => number): Look {
  const worn = new Set<string>(taken.map((l) => l.design));
  const fresh = DESIGNS.filter((d) => !worn.has(d.id));
  if (fresh.length) return { design: pick(rand, fresh).id, shape: pick(rand, SHAPES), swap: rand() < SWAP };
  const had = new Set(taken.map(lookKey));
  const open = allLooks().filter((l) => !had.has(lookKey(l)));
  return pick(rand, open.length ? open : allLooks());
}

/**
 * Looks for [ids], oldest first: each keeps the look it has in [looks]; one
 * without gets a pick among the others' looks. A look whose id is gone is
 * dropped, unless [ids] is empty (a list that could not be read). [looks]
 * itself comes back when nothing changed.
 */
export function assignLooks(
  looks: Readonly<Record<string, Look>>,
  ids: readonly string[],
  rand: () => number,
): Readonly<Record<string, Look>> {
  const next: Record<string, Look> = {};
  let changed = false;
  for (const id of ids) {
    const kept = looks[id];
    next[id] = kept ?? pickLook(Object.values(next), rand);
    changed ||= !kept;
  }
  if (!ids.length) return looks;
  changed ||= Object.keys(looks).some((id) => !(id in next));
  return changed ? next : looks;
}
