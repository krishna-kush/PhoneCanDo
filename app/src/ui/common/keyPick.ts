// One of `count` things picked by a string, the same key always landing on
// the same one: a custom kind's mascot by its id. FNV-1a over the key, so a
// key that changes a little still moves, and people can tell each other
// which one they got. Pure (zero RN imports).
export function pickIndex(key: string, count: number): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h % count;
}
