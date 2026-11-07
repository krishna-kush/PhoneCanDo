// The free "any image name" field: `kalilinux/kali-rolling`, `alpine:3.22`,
// `ghcr.io/owner/tool`. Checked against the registry's own name grammar so a
// typo is caught here, not after a network round trip. Only Docker Hub can
// list versions; another registry's image goes straight to the download
// (its tag, else `latest`). Pure (zero RN imports).

export type ImageRef =
  | { ok: true; repo: string; tag: string | null; hub: boolean }
  | { ok: false; reason: 'empty' | 'digest' | 'invalid' };

const HUB_DOMAINS = new Set(['docker.io', 'index.docker.io', 'registry-1.docker.io']);

const PATH_COMPONENT = /^[a-z0-9]+(?:(?:[._]|__|-+)[a-z0-9]+)*$/;
const DOMAIN = /^(?:localhost|[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?)*)(?::\d+)?$/;
const TAG = /^[\w][\w.-]{0,127}$/;

export function parseImageRef(input: string): ImageRef {
  // People paste whole commands; the image is what matters.
  const text = input.trim().replace(/^docker\s+pull\s+/i, '').trim();
  if (!text) return { ok: false, reason: 'empty' };
  if (text.includes('@')) return { ok: false, reason: 'digest' };
  const lastSlash = text.lastIndexOf('/');
  const colon = text.indexOf(':', lastSlash + 1);
  const name = colon >= 0 ? text.slice(0, colon) : text;
  const tag = colon >= 0 ? text.slice(colon + 1) : null;
  if (tag != null && !TAG.test(tag)) return { ok: false, reason: 'invalid' };
  const parts = name.split('/');
  const first = parts[0];
  const hasDomain = parts.length > 1 && (first.includes('.') || first.includes(':') || first === 'localhost');
  if (hasDomain && !DOMAIN.test(first)) return { ok: false, reason: 'invalid' };
  const path = (hasDomain ? parts.slice(1) : parts).map((p) => p.toLowerCase());
  if (path.length === 0 || !path.every((p) => PATH_COMPONENT.test(p))) return { ok: false, reason: 'invalid' };
  const hub = !hasDomain || HUB_DOMAINS.has(first.toLowerCase());
  const repo = [...(hub ? [] : [first.toLowerCase()]), ...path].join('/');
  return { ok: true, repo, tag, hub };
}

/** Why a typed name was refused, in plain words. */
export function imageRefProblem(reason: 'empty' | 'digest' | 'invalid'): string {
  switch (reason) {
    case 'empty':
      return 'Type an image name, e.g. kalilinux/kali-rolling.';
    case 'digest':
      return 'Use a tag instead of a digest, e.g. alpine:3.22.';
    case 'invalid':
      return "That isn't a valid image name. Names use lowercase letters, digits, dots, dashes and slashes.";
  }
}

/** Whether a parsed repo lives on Docker Hub (the only registry we can list versions of). */
export function isHubRepo(repo: string): boolean {
  const parts = repo.split('/');
  const first = parts[0];
  return parts.length === 1 || !(first.includes('.') || first.includes(':') || first === 'localhost');
}
