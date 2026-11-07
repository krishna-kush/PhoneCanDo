// The page each agent's web UI was last on, so switching back to an agent
// lands there instead of the web home. Kept in memory (a cold start opens
// the home) and as a path only: an engine can come back on another port.
// No RN imports.
const pages = new Map<string, string>();

/** An http(s) URL split into its origin and the rest (path, query, hash). */
export function splitUrl(url: string): { origin: string; path: string } | null {
  const m = /^(https?:\/\/[^/?#]+)(.*)$/i.exec(url);
  return m ? { origin: m[1], path: m[2] || '/' } : null;
}

export function rememberPage(agentId: string, url: string): void {
  const parts = splitUrl(url);
  if (parts) pages.set(agentId, parts.path);
}

export function lastPage(agentId: string): string | null {
  return pages.get(agentId) ?? null;
}

/**
 * Where a freshly paired view that just loaded [loadedUrl] goes next: the
 * remembered [target] path on the same origin, or null to stay. Null too
 * when only the hash differs, since that navigation never leaves the
 * document and so never reports a finished load.
 */
export function restoreUrl(loadedUrl: string, target: string | null): string | null {
  if (!target) return null;
  const at = splitUrl(loadedUrl);
  if (!at || withoutHash(at.path) === withoutHash(target)) return null;
  return at.origin + target;
}

function withoutHash(path: string): string {
  return path.split('#')[0];
}
