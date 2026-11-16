// A line's bars from its runs in bars.ts: the widths, in modules, of each
// bar and the space after it, bar first, a digit each (Code 128's are 1 to
// 4), as an SVG path one module wide and one high per unit, with
// ten-module quiet zones either side, as the site's. Pure (zero RN
// imports).
const QUIET = 10;

export function drawBars(runs: string): { width: number; path: string } {
  let x = QUIET;
  let path = '';
  for (let i = 0; i < runs.length; i++) {
    const w = Number(runs[i]);
    if (i % 2 === 0) path += `M${x} 0h${w}v1h-${w}z`;
    x += w;
  }
  return { width: x + QUIET, path };
}
