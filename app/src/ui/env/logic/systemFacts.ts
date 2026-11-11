// What a system's page says about it, one fact per row. Pure (zero RN
// imports): scripts/vectors/test_env_flows.js checks it.
import type { Env } from '../../../engine/linux/types';
import { formatAgo, formatBytes } from './format.ts';
import { osName } from './titles.ts';

export type Fact = { label: string; value: string };

type EnvLike = Pick<Env, 'source' | 'state' | 'os' | 'sizeBytes' | 'createdAt'>;

// `sha256:` and 12 hex characters, as docker prints short ids.
const SHORT_DIGEST = 19;

export function systemFacts(env: EnvLike, now: number): Fact[] {
  const facts: Fact[] = [];
  const { source } = env;
  switch (source.kind) {
    case 'default':
      facts.push({ label: 'Kind', value: 'Default · in the app' });
      break;
    case 'registry':
      facts.push({ label: 'Kind', value: 'Own · downloaded' });
      facts.push({ label: 'Image', value: `${source.image}:${source.tag.trim() || 'latest'}` });
      if (source.digest) facts.push({ label: 'Digest', value: source.digest.slice(0, SHORT_DIGEST) });
      break;
    case 'android':
      facts.push({ label: 'Kind', value: "Android's own shell, no Linux" });
      break;
  }
  if (source.kind !== 'android') {
    const os = env.os ? osName(env.os) : env.state === 'downloading' ? 'known once downloaded' : 'not detected yet';
    facts.push({ label: 'OS', value: os });
    facts.push({ label: 'Packages', value: env.os?.family ?? (env.os ? 'no package manager' : '—') });
  }
  if (env.sizeBytes > 0) facts.push({ label: 'Size', value: formatBytes(env.sizeBytes) });
  else if (source.kind === 'default') facts.push({ label: 'Size', value: 'part of the app' });
  const added = formatAgo(env.createdAt, now);
  if (added) facts.push({ label: 'Added', value: added });
  return facts;
}
