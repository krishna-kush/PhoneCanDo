// Which Docker Hub logo stands for a system. Logos are filed by pull name
// (`alpine`, `kalilinux/kali-rolling`), as the Hub catalog lists them.
// Pure (zero RN imports).
import type { Env } from '../../../engine/linux/types';

const HUB_PREFIXES = ['docker.io/', 'index.docker.io/', 'registry-1.docker.io/'];

/** The Default system's OS before it is set up and detected: it is Debian-based. */
export const DEFAULT_OS_ID = 'debian';

/** A Docker Hub image as the catalog names it: `docker.io/library/alpine` → `alpine`. */
export function hubName(image: string): string {
  let name = image.trim().toLowerCase();
  const host = HUB_PREFIXES.find((p) => name.startsWith(p));
  if (host) name = name.slice(host.length);
  return name.startsWith('library/') ? name.slice('library/'.length) : name;
}

/**
 * The names a system's logo may be filed under, best first: the image it
 * came from, then its OS's os-release id (official images are named after
 * it: `debian`, `ubuntu`, `alpine`). The Default system is Debian-based;
 * Android has none.
 */
export function logoKeys(env: Pick<Env, 'source' | 'os'>): string[] {
  const osId = env.os?.id.trim().toLowerCase() || null;
  switch (env.source.kind) {
    case 'default':
      return [osId ?? DEFAULT_OS_ID];
    case 'registry': {
      const image = hubName(env.source.image);
      return osId && osId !== image ? [image, osId] : [image];
    }
    case 'android':
      return [];
  }
}

/** The first logo on file for `keys`, else null. */
export function pickLogo(keys: readonly string[], logos: Readonly<Record<string, string>>): string | null {
  for (const key of keys) {
    const url = logos[key];
    if (url) return url;
  }
  return null;
}
