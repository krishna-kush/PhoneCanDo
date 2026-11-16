// Which line a box's barcode carries: its title's FNV-1a hash over the
// lines, so a box always wears the same one, a title that changes (a count,
// a day) included, and people can tell each other which box to scan.
export function lineFor(title: string, count: number): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < title.length; i++) {
    h ^= title.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h % count;
}
