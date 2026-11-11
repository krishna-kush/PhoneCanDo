// Which cards a pack holds. Pure; [random] has Math.random's shape.

/** Cards a pack holds. */
export const PACK = 3;

/**
 * A pack: [must] first (the first pack's built-in card), then cards not
 * yet [got], at random, and ones already got only when too few new are
 * left, so the set fills in the fewest packs.
 */
export function drawPack(deck: string[], got: ReadonlySet<string>, must: string[] = [], random = Math.random) {
  const shuffled = (ids: string[]) => {
    const out = [...ids];
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  };
  const rest = deck.filter((id) => !must.includes(id));
  return [
    ...must.filter((id) => deck.includes(id)),
    ...shuffled(rest.filter((id) => !got.has(id))),
    ...shuffled(rest.filter((id) => got.has(id))),
  ].slice(0, PACK);
}
