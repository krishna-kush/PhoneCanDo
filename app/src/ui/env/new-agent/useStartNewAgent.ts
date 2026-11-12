import { soleOffer } from '../../../engine/agents/offers';
import type { AgentKindId } from '../../../engine/agents/registry';
import { useAgentsStore } from '../../../state/agents';
import { useAppStore } from '../../../state/app';
import { offersForEnv, shareBlockFor } from '../../../state/flows/kindOffers';
import { asksForModel } from '../../../state/flows/newAgent';
import { useLinuxStore } from '../../../state/linux';
import { anyPlaceOfferEnv } from '../logic/agentChoice';
import { shareChoices } from '../logic/shareChoices';
import { useNewAgent } from './useNewAgent';

// The drawer's New agent: the agent first, then where it runs. With one
// kind and no model to ask about, it goes straight to the place step. A
// build without Linux has one place of its own, Android's own shell: there
// it goes as it always did (made at once, or Choose agent for that place),
// unless the agent could share a machine instead, which the place step
// offers.
export function useStartNewAgent() {
  const push = useAppStore((s) => s.push);
  const linuxAvailable = useLinuxStore((s) => s.status.available);
  const newAgent = useNewAgent();

  const start = () => {
    const kindId = soleOffer(offersForEnv(anyPlaceOfferEnv(linuxAvailable)))?.id ?? null;
    if (!linuxAvailable && !canShare(kindId)) {
      newAgent.start({ kind: 'android' });
      return;
    }
    if (kindId && !asksForModel(kindId)) push({ name: 'new-agent-place', pick: { kindId, modelId: null } });
    else push({ name: 'new-agent' });
  };

  return { start, busy: newAgent.busy, error: newAgent.error };
}

// Without Linux: a machine agents use that the sole kind could join (any
// such machine while the kind is still to be picked).
function canShare(kindId: AgentKindId | null): boolean {
  const { envs, images } = useLinuxStore.getState();
  const choices = shareChoices(envs, images, useAgentsStore.getState().agents, false);
  return kindId == null ? choices.length > 0 : choices.some((c) => shareBlockFor(c, kindId) == null);
}
