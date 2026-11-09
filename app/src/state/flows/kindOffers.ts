// The agent kinds a creation step offers for an env: this build's channel
// and kinds, judged by engine/agents/offers.ts (pure).
import { offerEnvOf, offersFor, soleOffer, type Offer, type OfferEnv } from '../../engine/agents/offers';
import { allKinds, type AgentKindId } from '../../engine/agents/registry';
import type { Env } from '../../engine/linux/types';
import { getBuildChannel } from '../../engine/runner';

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
