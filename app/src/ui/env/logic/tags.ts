// The version picker's list. Native already keeps only tags with an arm64
// build and orders each page; across loaded pages we put the tags people
// usually want first again. Pure (zero RN imports).

export type TagLike = { name: string };

const CHANNELS = new Set(['latest', 'stable', 'rolling', 'lts']);
const VERSION = /^v?\d+(\.\d+){0,2}$/;
const CODENAME = /^[a-z]+$/;

// Lower comes first: latest, channel words, plain versions, codenames, the rest.
function rank(name: string): number {
  if (name === 'latest') return 0;
  if (CHANNELS.has(name)) return 1;
  if (VERSION.test(name)) return 2;
  if (CODENAME.test(name)) return 3;
  return 4;
}

function versionParts(name: string): number[] {
  return name.replace(/^v/, '').split('.').map(Number);
}

function compareVersionsDesc(a: string, b: string): number {
  const pa = versionParts(a);
  const pb = versionParts(b);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pb[i] ?? -1) - (pa[i] ?? -1);
    if (d !== 0) return d;
  }
  return 0;
}

/** Common tags first (newest version first among plain versions); otherwise the registry's order. */
export function rankTags<T extends TagLike>(tags: readonly T[]): T[] {
  return tags
    .map((tag, i) => ({ tag, i, r: rank(tag.name) }))
    .sort((a, b) => {
      if (a.r !== b.r) return a.r - b.r;
      if (a.r === 2) return compareVersionsDesc(a.tag.name, b.tag.name) || a.i - b.i;
      return a.i - b.i;
    })
    .map((x) => x.tag);
}

/** Pages of tags joined without repeats (a tag can move between pages while we read). */
export function mergeTags<T extends TagLike>(have: readonly T[], more: readonly T[]): T[] {
  const seen = new Set(have.map((t) => t.name));
  return [...have, ...more.filter((t) => !seen.has(t.name))];
}

/** Pages we read on our own while they bring no arm64 tag, before asking for "Load more". */
export const EMPTY_PAGES_TO_SKIP = 3;
