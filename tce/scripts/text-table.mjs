// Aligned plain-text tables for the read-only scripts (stats, check-limits).
// Zero deps.

/**
 * Formats rows under a header as an aligned table with a dashed rule.
 * `right` lists the column indexes to right-align. Returns the lines joined by \n.
 */
export function formatTable(head, rows, right = []) {
  const cells = [head, ...rows].map((r) => r.map((c) => String(c ?? '')));
  const width = head.map((_, i) => Math.max(...cells.map((r) => r[i].length)));
  const line = (r) =>
    r
      .map((c, i) => (right.includes(i) ? c.padStart(width[i]) : c.padEnd(width[i])))
      .join('  ')
      .trimEnd();
  return [line(cells[0]), width.map((w) => '-'.repeat(w)).join('  '), ...cells.slice(1).map(line)].join('\n');
}
