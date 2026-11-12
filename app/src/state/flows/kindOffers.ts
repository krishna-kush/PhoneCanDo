// The agent kinds a creation step offers for an env: this build's channel
// and kinds, judged by engine/agents/offers.ts (pure); and whether a kind
// can join a machine agents already use (logic/machineTenants.ts).
import { offerEnvOf, offersFor, soleOffer, type Offer, type OfferEnv } from '../../engine/agents/offers';
import type { Agent } from '../../engine/agents/records';
import { agentKind, allKinds, type AgentKindId } from '../../engine/agents/registry';
import type { Env, ImageState } from '../../engine/linux/types';
import { getBuildChannel } from '../../engine/runner';
import { shareBlockOf, type ShareBlock } from './logic/machineTenants';

export function offersForEnv(env: OfferEnv): Offer[] {
  return offersFor({ channel: getBuildChannel(), env, kinds: allKinds() });
}

/** The kind a fresh install starts with (preselected in the step); null without kinds. */
export function defaultKindId(): AgentKindId | null {
  return allKinds().find((k) => k.isDefault)?.id ?? null;
}

/** The kind to make on this env without asking (only one can show there), else null. */
export function soleKindFor(env: Env): AgentKindId | null {
  return soleOffer(offersForEnv(offerEnvOf(env)))?.id ?? null;
}

/** Why a new agent of this kind can't join the machine (its system judged by `env`); null when it can. */
export function shareBlockFor(
  machine: { state: ImageState; env: OfferEnv; agents: readonly Pick<Agent, 'kind'>[] },
  kindId: AgentKindId,
): ShareBlock | null {
  const offer = offersForEnv(machine.env).find((o) => o.id === kindId);
  return shareBlockOf(machine, agentKind(kindId), offer ? offer.blocked : 'env_not_ready');
}
