// Plain-text tables for the release preflight report.

/**
 * Rows of cells as left-aligned columns two spaces apart; the last column is
 * not padded. paint(text, row, column) styles a cell after it is padded, so
 * colour codes never skew the widths (row -1 is the header).
 */
export function renderTable(header, rows, paint = (text) => text) {
  const all = [header, ...rows].map((row) => row.map((cell) => String(cell ?? '')));
  const widths = header.map((_, i) => Math.max(...all.map((row) => row[i].length)));
  return all.map((row, r) =>
    row
      .map((cell, i) => paint(i === row.length - 1 ? cell : cell.padEnd(widths[i]), r - 1, i))
      .join('  ')
      .trimEnd(),
  );
}
