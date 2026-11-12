import { useState } from 'react';
import { soleOffer } from '../../../engine/agents/offers';
import type { Agent } from '../../../engine/agents/records';
import type { AgentKindId } from '../../../engine/agents/registry';
import type { ImageId } from '../../../engine/linux/types';
import { createAgentFromEnv, createAndroidAgent, createDefaultAgent } from '../../../state/flows/createAgentFromEnv';
import { createAgentOnMachine } from '../../../state/flows/createAgentOnMachine';
import { createOwnEnv } from '../../../state/flows/createOwnEnv';
import { offersForEnv } from '../../../state/flows/kindOffers';
import type { AgentPick } from '../../../state/flows/logic/modelStep';
import { asksForModel } from '../../../state/flows/newAgent';
import { useAppStore, type NewAgentTarget } from '../../../state/app';
import { useLinuxStore } from '../../../state/linux';
import { targetOfferEnv } from '../logic/agentChoice';
import { linuxFailureText } from '../logic/errorText';

// A new agent for a place already known (New agent here, Android only, a
// place or a download picked). `start` makes it at once when only one kind
// can be made there and there is no model to ask about (the Model step),
// else opens the Choose agent step for that place; `make` makes the pick,
// then opens the agent's page in place of the run's steps. An Own env
// starts its download instead and moves to its progress page; the run
// makes the agent after. `share` makes the pick on a machine other agents
// use, then opens its page the same way.
export function useNewAgent() {
  const push = useAppStore((s) => s.push);
  const finishCreation = useAppStore((s) => s.finishCreation);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The made agent's page in place of the run's steps, or why it wasn't made.
  const finish = (made: Promise<Agent>) => {
    made
      .then((agent) => finishCreation({ name: 'agent', agentId: agent.id, fresh: true }))
      .catch((e: unknown) => setError(linuxFailureText(e)))
      .finally(() => setBusy(false));
  };

  const make = (target: NewAgentTarget, pick: AgentPick) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    if (target.kind === 'own') {
      // Busy until the download starts; from then on its page follows the run.
      let started = false;
      createOwnEnv({ image: target.repo, tag: target.tag.name }, pick, ({ envId }) => {
        started = true;
        finishCreation({ name: 'new-env-pull', repo: target.repo, tag: target.tag.name, envId });
      })
        .catch((e: unknown) => {
          if (!started) setError(linuxFailureText(e));
        })
        .finally(() => {
          if (!started) setBusy(false);
        });
      return;
    }
    finish(agentFor(target, pick));
  };

  const share = (imageId: ImageId, pick: AgentPick) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    finish(createAgentOnMachine(imageId, pick));
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
    else push({ name: 'new-agent', target });
  };

  /** Whether `start` would ask (Choose agent) rather than make it at once. */
  const asks = (target: NewAgentTarget) => soleKind(target) == null;

  return { busy, error, start, make, share, asks };
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
