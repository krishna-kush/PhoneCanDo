// What each share link did: POST /v1/share/stats on our API host with the
// links' codes, nothing else (whoever holds a link may read its counts, so
// no identity goes with it). At most 100 codes per request.
import { apiBase } from '../apiHost';
import { parseStats, type LinkStats } from './wire';

export type { LinkStats };

const PER_REQUEST = 100;
const TIMEOUT_MS = 10_000;

async function post(codes: string[]): Promise<Record<string, LinkStats> | null> {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${apiBase()}/v1/share/stats`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ codes }),
      signal: abort.signal,
    });
    if (!res.ok) return null;
    return parseStats(await res.json());
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Stats by code for every code asked; null when any request failed. */
export async function fetchShareStats(codes: readonly string[]): Promise<Record<string, LinkStats> | null> {
  const out: Record<string, LinkStats> = {};
  for (let i = 0; i < codes.length; i += PER_REQUEST) {
    const part = await post(codes.slice(i, i + PER_REQUEST));
    if (!part) return null;
    Object.assign(out, part);
  }
  return out;
}
