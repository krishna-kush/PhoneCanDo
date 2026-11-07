// Plain-text tables for the release preflight report.

/** Rows of cells as left-aligned columns two spaces apart; the last column is not padded. */
export function renderTable(header, rows) {
  const all = [header, ...rows].map((row) => row.map((cell) => String(cell ?? '')));
  const widths = header.map((_, i) => Math.max(...all.map((row) => row[i].length)));
  return all.map((row) =>
    row
      .map((cell, i) => (i === row.length - 1 ? cell : cell.padEnd(widths[i])))
      .join('  ')
      .trimEnd(),
  );
}
