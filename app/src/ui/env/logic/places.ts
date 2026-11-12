// New agent's place step: where the picked agent can run. Pure (zero RN
// imports). Default first (recommended: in the app, no download), then the
// Own envs oldest first, then Android's own shell where one is set up, then
// a download of another Linux. Each place carries the env its offers are
// judged against (agentChoice.ts targetOfferEnv), so a place that cannot run
// the agent says why instead of failing later. A system's place carries the
// names its logo is filed under (osLogo.ts).
import type { OfferEnv } from '../../../engine/agents/offers.ts';
import type { Env } from '../../../engine/linux/types';
import type { NewAgentTarget } from '../../../state/app/routes';
import { targetOfferEnv } from './agentChoice.ts';
import { DEFAULT_OS_ID, logoKeys } from './osLogo.ts';
import { DEFAULT_ENV_TITLE, envSubtitle, envTitle } from './titles.ts';

type EnvLike = Pick<Env, 'id' | 'source' | 'state' | 'os' | 'sizeBytes' | 'createdAt'>;

export type Place = {
  key: string;
  title: string;
  subtitle: string;
  /** Where the agent's machine comes from; null: download another Linux first. */
  target: NewAgentTarget | null;
  env: OfferEnv;
  recommended: boolean;
  /** The names its logo may be filed under, best first; empty: its letter. */
  logoKeys: string[];
};

const DOWNLOAD: OfferEnv = { kind: 'linux', family: null, ready: true };

export function placesFor(envs: readonly EnvLike[], linuxAvailable: boolean): Place[] {
  const places: Place[] = [];
  if (linuxAvailable) {
    const base = envs.find((e) => e.source.kind === 'default' && e.state === 'ready');
    const target: NewAgentTarget = { kind: 'default' };
    places.push({
      key: 'default',
      title: DEFAULT_ENV_TITLE,
      subtitle: base ? envSubtitle(base) : 'Debian-based · ready in about half a minute, no download',
      target,
      env: targetOfferEnv(target, envs),
      recommended: true,
      logoKeys: base ? logoKeys(base) : [DEFAULT_OS_ID],
    });
  }
  const others = envs
    .filter((e) => e.source.kind === 'registry' || e.source.kind === 'android')
    .sort((a, b) => (a.source.kind === 'android' ? 1 : 0) - (b.source.kind === 'android' ? 1 : 0) || a.createdAt - b.createdAt);
  for (const env of others) {
    if (env.source.kind === 'registry' && !linuxAvailable) continue;
    const target: NewAgentTarget = { kind: 'env', envId: env.id };
    places.push({
      key: env.id,
      title: envTitle(env.source),
      subtitle: envSubtitle(env),
      target,
      env: targetOfferEnv(target, envs),
      recommended: false,
      logoKeys: logoKeys(env),
    });
  }
  if (linuxAvailable) {
    places.push({
      key: 'download',
      title: 'Download another Linux',
      subtitle: 'Any Docker image: Alpine, Ubuntu, Fedora, Arch, Kali…',
      target: null,
      env: DOWNLOAD,
      recommended: false,
      logoKeys: [],
    });
  }
  return places;
}
