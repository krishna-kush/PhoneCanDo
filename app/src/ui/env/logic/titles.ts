// What an env and its OS are called on screen. Pure (zero RN imports).
import type { Env, EnvSource, OsInfo } from '../../../engine/linux/types';
import { formatBytes } from './format.ts';

// `sha256:` and 12 hex characters, as docker prints short ids.
const SHORT_DIGEST = 19;

export const DEFAULT_ENV_TITLE = 'Debian-based (Default)';

/** "Debian-based (Default)", "alpine:3.22" or "Android (no Linux)". */
export function envTitle(source: EnvSource): string {
  switch (source.kind) {
    case 'default':
      return DEFAULT_ENV_TITLE;
    case 'registry': {
      const tag = source.tag.trim();
      if (!tag) return `${source.image}:latest`;
      if (tag.startsWith('sha256:')) return `${source.image}@${tag.slice(0, SHORT_DIGEST)}`;
      return `${source.image}:${tag}`;
    }
    case 'android':
      return 'Android (no Linux)';
  }
}

function capitalize(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

/** The detected OS's name: os-release PRETTY_NAME, else "Id version". */
export function osName(os: OsInfo): string {
  const pretty = os.prettyName?.trim();
  if (pretty) return pretty;
  return [capitalize(os.id), os.versionId].filter(Boolean).join(' ');
}

/** "Alpine Linux v3.22 · apk"; null before detection. */
export function osLine(os: OsInfo | null): string | null {
  if (!os) return null;
  return `${osName(os)} · ${os.family ?? 'no package manager'}`;
}

/** An env's line under its title: its state while not ready, else "OS · size". */
export function envSubtitle(env: Pick<Env, 'state' | 'source' | 'os' | 'sizeBytes'>): string {
  if (env.state === 'downloading') return 'Downloading';
  if (env.state === 'failed') return 'Download stopped';
  const os = env.source.kind === 'android' ? "Android's own shell" : osLine(env.os);
  const size = env.sizeBytes > 0 ? formatBytes(env.sizeBytes) : null;
  return [os, size].filter(Boolean).join(' · ');
}
