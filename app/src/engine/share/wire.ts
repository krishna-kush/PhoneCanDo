// What POST /v1/share/stats answers (tce), read defensively: a malformed
// entry is skipped, a missing count reads as 0. Pure (zero RN imports).

/** What one share link did, as the server counted it. */
export type LinkStats = {
  code: string;
  opened: number;
  downloaded: number;
  installed: number;
  /** Installs from the link that came back on a later day. */
  using: number;
  /** The last UTC day anything happened (YYYY-MM-DD), or null. */
  lastDay: string | null;
};

function count(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
}

/** `{ links: [...] }` to stats by code; null when there is no list. */
export function parseStats(v: unknown): Record<string, LinkStats> | null {
  const list = v !== null && typeof v === 'object' ? (v as { links?: unknown }).links : undefined;
  if (!Array.isArray(list)) return null;
  const out: Record<string, LinkStats> = {};
  for (const item of list) {
    if (item === null || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    if (typeof o.code !== 'string') continue;
    out[o.code] = {
      code: o.code,
      opened: count(o.opened),
      downloaded: count(o.downloaded),
      installed: count(o.installed),
      using: count(o.using),
      lastDay: typeof o.lastDay === 'string' ? o.lastDay : null,
    };
  }
  return out;
}
