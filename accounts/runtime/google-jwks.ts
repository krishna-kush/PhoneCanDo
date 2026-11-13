// Fetches Google's ID-token signing keys (core/google/keys.ts caches them).

import type { JwksFetch } from '../core/google/keys.ts';
import { maxAgeOf } from '../core/google/keys.ts';

/** Where Google publishes the keys it signs ID tokens with. */
export const GOOGLE_CERTS_URL = 'https://www.googleapis.com/oauth2/v3/certs';

/** A plain fetch, so tests can hand in their own. */
export type FetchLike = (url: string) => Promise<{ ok: boolean; status: number; headers: { get(name: string): string | null }; json(): Promise<unknown> }>;

/** A JwksFetch over `fetchFn`; throws when Google does not answer 200 with JSON. */
export function googleJwks(fetchFn: FetchLike = (url) => fetch(url)): JwksFetch {
  return async () => {
    const res = await fetchFn(GOOGLE_CERTS_URL);
    if (!res.ok) throw new Error(`Google's keys answered ${res.status}`);
    const body = await res.json();
    const keys = typeof body === 'object' && body !== null ? (body as { keys?: unknown }).keys : undefined;
    return { keys, maxAgeS: maxAgeOf(res.headers.get('cache-control')) };
  };
}
