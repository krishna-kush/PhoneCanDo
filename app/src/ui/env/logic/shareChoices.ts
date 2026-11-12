// New agent's place step, Share a machine: the machines agents already use,
// each with its agents, for the new agent to join. Pure (zero RN imports).
// Ordered as the systems are (Default first, Own envs oldest first, Android
// last), then oldest first. A Linux machine shows only where Linux runs; a
// machine no agent uses (a setup cut short) never shows. Each carries the
// env the picked kind is judged against (offers.ts) and, apart from it, its
// own state (machineTenants.ts shareBlockOf), so a machine the agent cannot
// join says why.
import type { OfferEnv } from '../../../engine/agents/offers.ts';
import type { Agent } from '../../../engine/agents/records';
import type { Env, Image, ImageId, ImageState } from '../../../engine/linux/types';
import { agentsOn, type ShareBlock } from '../../../state/flows/logic/machineTenants.ts';
import { nameList } from '../../memory/logic/memoryCopy.ts';
import { blockedText } from './agentChoice.ts';
import { formatBytes } from './format.ts';
import { logoKeys } from './osLogo.ts';
import { envTitle } from './titles.ts';

type EnvLike = Pick<Env, 'id' | 'source' | 'os' | 'createdAt'>;
type ImageLike = Pick<Image, 'id' | 'envId' | 'state' | 'os' | 'sizeBytes' | 'createdAt'>;
type AgentLike = Pick<Agent, 'id' | 'kind' | 'name' | 'imageId' | 'createdAt'>;

export type ShareChoice<A> = {
  key: string;
  imageId: ImageId;
  state: ImageState;
  /** Its agents, oldest first. */
  agents: A[];
  /** Its agents' names: "opencode and Claude Code". */
  title: string;
  /** Its system's name. */
  system: string;
  /** Its system and size: "Debian-based (Default) · 1.2 GB". */
  subtitle: string;
  /** Its system as the offers see it, judged as ready (`state` says whether it is). */
  env: OfferEnv;
  /** The names its system's logo may be filed under, best first; empty: a letter. */
  logoKeys: string[];
};

const SOURCE_ORDER: Record<Env['source']['kind'], number> = { default: 0, registry: 1, android: 2 };

export function shareChoices<E extends EnvLike, I extends ImageLike, A extends AgentLike>(
  envs: readonly E[],
  images: readonly I[],
  agents: readonly A[],
  linuxAvailable: boolean,
): ShareChoice<A>[] {
  const rows: { choice: ShareChoice<A>; env: E | undefined; since: number }[] = [];
  for (const image of images) {
    const on = agentsOn(agents, image.id);
    if (on.length === 0) continue;
    const env = envs.find((e) => e.id === image.envId);
    const linux = env ? env.source.kind !== 'android' : image.os != null;
    if (linux && !linuxAvailable) continue;
    const system = env ? envTitle(env.source) : linux ? 'Linux machine' : "Android's own shell";
    const size = image.sizeBytes > 0 ? formatBytes(image.sizeBytes) : null;
    const os = image.os ?? env?.os ?? null;
    rows.push({
      choice: {
        key: image.id,
        imageId: image.id,
        state: image.state,
        agents: on,
        title: nameList(on.map((a) => a.name)),
        system,
        subtitle: [system, size].filter(Boolean).join(' · '),
        env: { kind: linux ? 'linux' : 'android', family: os?.family ?? null, ready: true },
        logoKeys: env ? logoKeys({ source: env.source, os }) : [],
      },
      env,
      since: on[0].createdAt,
    });
  }
  const order = (env: E | undefined) => (env ? SOURCE_ORDER[env.source.kind] : 3);
  rows.sort(
    (a, b) =>
      order(a.env) - order(b.env) || (a.env?.createdAt ?? 0) - (b.env?.createdAt ?? 0) || a.since - b.since,
  );
  return rows.map((r) => r.choice);
}

const NOT_READY: Record<ImageState, string> = {
  creating: 'This machine is still being set up',
  resetting: 'This machine is being reset',
  deleting: 'This machine is being deleted',
  failed: "This machine's setup didn't finish",
  ready: '',
};

/** Why the picked agent can't join a machine, in one line; null when it can. */
export function shareBlockText(block: ShareBlock | null, kindLabel: string): string | null {
  if (!block) return null;
  switch (block.kind) {
    case 'not_ready':
      return NOT_READY[block.state] || null;
    case 'offer':
      return blockedText(block.block);
    case 'same_kind':
      return `Two ${kindLabel} agents can't share a machine`;
  }
}
