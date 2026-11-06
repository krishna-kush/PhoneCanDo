// Referrer and path normalization for analytics points: only a host survives
// from a referrer, and a page path loses its query and fragment.

import { LIMITS } from './schema/limits.ts';
import { truncate } from './validate.ts';

/**
 * Host of `ref`, lowercased and capped at LIMITS.hostLength; null when `ref`
 * is missing, unparsable, has no host, or points at the request's own host
 * (internal navigation is not a referral).
 */
export function refHost(ref: string | null | undefined, requestHost: string | null): string | null {
  if (!ref) return null;
  let url: URL;
  try {
    url = new URL(ref);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase();
  if (!host) return null;
  if (requestHost) {
    const own = requestHost.toLowerCase();
    if (url.host === own || host === own || host === own.replace(/:\d+$/, '')) return null;
  }
  return truncate(host, LIMITS.hostLength);
}

/** `path` without query or fragment, capped at LIMITS.pathLength; null unless it starts with '/'. */
export function cleanPath(path: string): string | null {
  if (!path.startsWith('/')) return null;
  const bare = path.split(/[?#]/, 1)[0]!;
  return truncate(bare, LIMITS.pathLength);
}
