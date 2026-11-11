// Records re-read from native come back as new objects even when nothing in
// them changed. Keeping the old object for an equal record (and the old list
// or map when all are equal) lets a selector that returns one, like
// useActiveAgent, see the same value, so its screen skips the render.
// Pure (zero RN imports).

/** Deep equality for plain JSON-like values (what native records are). */
export function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((v, i) => sameValue(v, b[i]));
  }
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  const ob = b as Record<string, unknown>;
  return ka.every((k) => Object.prototype.hasOwnProperty.call(ob, k) && sameValue((a as Record<string, unknown>)[k], ob[k]));
}

/** `next`, with each record equal to one in `prev` (by id) swapped for that old object; `prev` itself when nothing changed. */
export function keepUnchangedList<T extends { id: string }>(prev: readonly T[], next: T[]): T[] {
  const old = new Map(prev.map((r) => [r.id, r]));
  const kept = next.map((r) => {
    const was = old.get(r.id);
    return was !== undefined && sameValue(was, r) ? was : r;
  });
  const same = kept.length === prev.length && kept.every((r, i) => r === prev[i]);
  return same ? (prev as T[]) : kept;
}

/** The same for a map by id. */
export function keepUnchangedMap<T>(prev: Readonly<Record<string, T>>, next: Record<string, T>): Record<string, T> {
  const kept: Record<string, T> = {};
  let same = Object.keys(prev).length === Object.keys(next).length;
  for (const [id, value] of Object.entries(next)) {
    const was = prev[id];
    kept[id] = was !== undefined && sameValue(was, value) ? was : value;
    if (kept[id] !== was) same = false;
  }
  return same ? (prev as Record<string, T>) : kept;
}
