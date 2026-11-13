// Google's signing keys, cached. Google rotates them every few weeks and
// publishes each set with a Cache-Control max-age; we keep a set that long,
// and an unknown key id fetches again at most once a minute (a new key in
// rotation, or junk ids, which must not turn every request into a fetch).
// The cache object is the host's to keep across requests; core keeps none.

import type { Clock, KeySource, RsaPublicJwk } from '../ports.ts';

/** Google's JWKS as fetched: the raw `keys` list and its max-age (s), when it gave one. */
export type JwksFetch = () => Promise<{ keys: unknown; maxAgeS: number | null }>;

/** Used when Google sends no max-age. */
const DEFAULT_MAX_AGE_S = 3600;
/** Bounds on how long a set is kept, whatever max-age says. */
const MIN_MAX_AGE_S = 60;
const MAX_MAX_AGE_S = 24 * 3600;
/** An unknown kid fetches again only this long after the last fetch. */
const REFETCH_GAP_MS = 60_000;

/** A KeySource that fetches with `fetchJwks` and caches by max-age. */
export function createKeyCache(fetchJwks: JwksFetch, clock: Clock): KeySource {
  let keys = new Map<string, RsaPublicJwk>();
  let expires = 0;
  let attemptedAt = Number.NEGATIVE_INFINITY;
  let inflight: Promise<void> | null = null;

  const refresh = (): Promise<void> => {
    // why one in flight: concurrent sign-ins share a fetch instead of each starting one.
    inflight ??= (async () => {
      attemptedAt = clock.now();
      try {
        const got = await fetchJwks();
        const now = clock.now();
        const parsed = parseJwks(got.keys);
        if (parsed.size === 0) throw new Error('Google listed no usable RS256 keys');
        keys = parsed;
        const age = Math.min(MAX_MAX_AGE_S, Math.max(MIN_MAX_AGE_S, got.maxAgeS ?? DEFAULT_MAX_AGE_S));
        expires = now + age * 1000;
      } finally {
        inflight = null;
      }
    })();
    return inflight;
  };

  return {
    async key(kid: string): Promise<RsaPublicJwk | null> {
      const now = clock.now();
      const due = now - attemptedAt >= REFETCH_GAP_MS;
      // A fetch already under way is joined, whatever it was started for.
      if (inflight || (due && (now >= expires || !keys.has(kid)))) {
        try {
          await refresh();
        } catch (e) {
          // A set we already hold still checks tokens while Google cannot be reached.
          if (!keys.has(kid)) throw e;
        }
      } else if (keys.size === 0) {
        // The last fetch failed under a minute ago: not the token's fault, so no bad_token.
        throw new Error("Google's keys are not loaded yet");
      }
      return keys.get(kid) ?? null;
    },
  };
}

/** The RSA keys of a JWKS `keys` list; anything else in it is skipped. */
export function parseJwks(list: unknown): Map<string, RsaPublicJwk> {
  const out = new Map<string, RsaPublicJwk>();
  if (!Array.isArray(list)) return out;
  for (const k of list) {
    if (typeof k !== 'object' || k === null) continue;
    const { kty, kid, n, e, alg, use } = k as Record<string, unknown>;
    if (kty !== 'RSA' || typeof kid !== 'string' || typeof n !== 'string' || typeof e !== 'string') continue;
    if (alg !== undefined && alg !== 'RS256') continue;
    if (use !== undefined && use !== 'sig') continue;
    out.set(kid, { kid, n, e });
  }
  return out;
}

/** max-age from a Cache-Control header, in seconds, or null. */
export function maxAgeOf(cacheControl: string | null): number | null {
  const m = cacheControl ? /(?:^|[,\s])max-age=(\d+)/i.exec(cacheControl) : null;
  return m ? Number(m[1]) : null;
}
