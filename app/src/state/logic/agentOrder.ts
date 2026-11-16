// The order the user keeps their agents in: the drawer's rows, dragged
// into place, and every list that follows the store's. Kept as agent ids;
// an agent not in it yet (new, or made before any drag) goes after the
// kept ones in the runner's order, and a deleted one's id drops out. Pure
// (zero RN imports); moveId also runs on the UI thread, mid-drag.

/** The kept ids from storage: strings only, each once. */
export function readOrder(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const id of raw) if (typeof id === 'string' && !out.includes(id)) out.push(id);
  return out;
}

/** The agents in the kept order, the ones it doesn't name after them as they came. */
export function inOrder<A extends { id: string }>(agents: readonly A[], order: readonly string[]): A[] {
  const at = (a: A) => {
    const i = order.indexOf(a.id);
    return i < 0 ? order.length : i;
  };
  // Array sort is stable: the unnamed ones keep the runner's order.
  return [...agents].sort((a, b) => at(a) - at(b));
}

/** The ids with `id` moved to index `to` (clamped); the same array when it is already there or absent. */
export function moveId(ids: readonly string[], id: string, to: number): readonly string[] {
  'worklet';
  const from = ids.indexOf(id);
  if (from < 0) return ids;
  const dest = Math.max(0, Math.min(ids.length - 1, Math.round(to)));
  if (dest === from) return ids;
  const out = ids.filter((x) => x !== id);
  out.splice(dest, 0, id);
  return out;
}
