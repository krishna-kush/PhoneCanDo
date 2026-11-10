import { useState } from 'react';
import { soleOffer } from '../../../engine/agents/offers';
import type { Agent } from '../../../engine/agents/records';
import type { AgentKindId } from '../../../engine/agents/registry';
import { createAgentFromEnv, createAndroidAgent, createDefaultAgent } from '../../../state/flows/createAgentFromEnv';
import { createOwnEnv } from '../../../state/flows/createOwnEnv';
import { offersForEnv } from '../../../state/flows/kindOffers';
import type { AgentPick } from '../../../state/flows/logic/modelStep';
import { asksForModel } from '../../../state/flows/newAgent';
import { useLinuxStore } from '../../../state/linux';
import { targetOfferEnv } from '../logic/agentChoice';
import { linuxFailureText } from '../logic/errorText';
import type { NewAgentTarget } from '../logic/routes';
import { useEnvNav } from '../nav';

// A new agent from any creation path. `start` makes it at once when only one
// kind can be made there and there is no model to ask about (the Model
// step), else opens the Choose agent step; `make` makes the pick, then opens
// the agent's page. An Own env starts its download instead and moves to its
// progress page; the run makes the agent after.
export function useNewAgent() {
  const open = useEnvNav((s) => s.open);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const make = (target: NewAgentTarget, pick: AgentPick) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    if (target.kind === 'own') {
      // Busy until the download starts; from then on its page follows the run.
      let started = false;
      createOwnEnv({ image: target.repo, tag: target.tag.name }, pick, ({ envId }) => {
        started = true;
        open({ name: 'new-env-pull', repo: target.repo, tag: target.tag.name, envId });
      })
        .catch((e: unknown) => {
          if (!started) setError(linuxFailureText(e));
        })
        .finally(() => {
          if (!started) setBusy(false);
        });
      return;
    }
    agentFor(target, pick)
      .then((agent) => open({ name: 'agent', agentId: agent.id }))
      .catch((e: unknown) => setError(linuxFailureText(e)))
      .finally(() => setBusy(false));
  };

  /** The one kind to make without asking, else null (the step asks). */
  const soleKind = (target: NewAgentTarget): AgentKindId | null => {
    const kindId = soleOffer(offersForEnv(targetOfferEnv(target, useLinuxStore.getState().envs)))?.id ?? null;
    return kindId && !asksForModel(kindId) ? kindId : null;
  };

  const start = (target: NewAgentTarget) => {
    if (busy) return;
    const kindId = soleKind(target);
    if (kindId) make(target, { kindId, modelId: null });
    else open({ name: 'new-agent', target });
  };

  return { busy, error, start, make, asks: (target: NewAgentTarget) => soleKind(target) == null };
}

function agentFor(target: Exclude<NewAgentTarget, { kind: 'own' }>, pick: AgentPick): Promise<Agent> {
  switch (target.kind) {
    case 'env':
      return createAgentFromEnv(target.envId, pick);
    case 'default':
      return createDefaultAgent(pick);
    case 'android':
      return createAndroidAgent(pick);
  }
}
