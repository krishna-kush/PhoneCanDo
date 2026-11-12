// Which floor the camera is on for a scroll position. Each part of the page
// (a section, the footer) is one floor of the backdrop, so the floor beside
// a part is the one in view while it is read. The reading line runs from the
// viewport's top at the start of the page to its bottom at the end: the
// camera opens over the first floor, with the sky above it, and comes to
// rest on the last one.

export type Band = { top: number; bottom: number; key: string };

/** Where the camera is, as a floor number: 2.5 is halfway through the third part. */
export function floorAt(bands: Band[], scrollY: number, viewH: number, docH: number): number {
  const n = bands.length;
  if (!n) return 0;
  const max = Math.max(1, docH - viewH);
  const line = scrollY + viewH * Math.min(1, Math.max(0, scrollY / max));
  if (line <= bands[0].top) return 0;
  for (let i = 0; i < n; i++) {
    const last = i === n - 1;
    const end = last ? docH : bands[i + 1].top;
    // The last part takes the camera only halfway, so it ends on that floor.
    const to = last ? i + 0.5 : i + 1;
    if (line < end || last) {
      const p = Math.min(1, (line - bands[i].top) / Math.max(1, end - bands[i].top));
      return i + p * (to - i);
    }
  }
  return n - 0.5;
}
