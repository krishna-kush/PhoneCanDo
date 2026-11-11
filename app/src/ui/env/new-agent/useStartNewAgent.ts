import { soleOffer } from '../../../engine/agents/offers';
import { useAppStore } from '../../../state/app';
import { offersForEnv } from '../../../state/flows/kindOffers';
import { asksForModel } from '../../../state/flows/newAgent';
import { useLinuxStore } from '../../../state/linux';
import { anyPlaceOfferEnv } from '../logic/agentChoice';
import { useNewAgent } from './useNewAgent';

// The drawer's New agent: the agent first, then where it runs. With one
// kind and no model to ask about, it goes straight to the place step. A
// build without Linux has one place, Android's own shell: there it goes as
// it always did (made at once, or Choose agent for that place).
export function useStartNewAgent() {
  const push = useAppStore((s) => s.push);
  const linuxAvailable = useLinuxStore((s) => s.status.available);
  const newAgent = useNewAgent();

  const start = () => {
    if (!linuxAvailable) {
      newAgent.start({ kind: 'android' });
      return;
    }
    const kindId = soleOffer(offersForEnv(anyPlaceOfferEnv(true)))?.id ?? null;
    if (kindId && !asksForModel(kindId)) push({ name: 'new-agent-place', pick: { kindId, modelId: null } });
    else push({ name: 'new-agent' });
  };

  return { start, busy: newAgent.busy, error: newAgent.error };
}
