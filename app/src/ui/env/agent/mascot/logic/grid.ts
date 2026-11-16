// The Mascot page's wardrobe in rows: as many tiles to a row as fit at
// their narrowest, sharing the row's width evenly, so the rack fills the
// page edge to edge on any phone. Pure (zero RN imports).

/** How many tiles at least [min] wide fit side by side in [width], [gap] apart; one at least. */
export function columnsFor(width: number, min: number, gap: number): number {
  return Math.max(1, Math.floor((width + gap) / (min + gap)));
}

/** [items] in rows of [columns], in order; the last row may be short. */
export function rowsOf<T>(items: readonly T[], columns: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += columns) rows.push(items.slice(i, i + columns));
  return rows;
}
