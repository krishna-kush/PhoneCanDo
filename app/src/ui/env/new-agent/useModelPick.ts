import { useEffect, useState } from 'react';
import { agentKind } from '../../../engine/agents/registry';
import type { LocalModel } from '../../../engine/models/types';
import { hasModelStep, heldModel } from '../../../state/flows/logic/modelStep';
import { useModelsStore } from '../../../state/models';

export type ModelPick = {
  /** The Model step shows: the kind takes a local model and one on this phone fits. */
  show: boolean;
  models: LocalModel[];
  /** The model picked; null: the agent's own setup (the default, and whenever the step does not show). */
  modelId: string | null;
  select: (modelId: string | null) => void;
};

// A new agent's Model step for the kind picked so far (logic/modelStep.ts):
// a pick survives a switch to another kind that takes models, and falls
// back to the agent's own setup when the step goes away.
export function useModelPick(kindId: string | null): ModelPick {
  const models = useModelsStore((s) => s.models);
  const [picked, select] = useState<string | null>(null);
  useEffect(() => {
    const store = useModelsStore.getState();
    if (!store.hydrated) store.hydrateModels();
  }, []);
  const kind = kindId ? agentKind(kindId) : null;
  return {
    show: kind != null && hasModelStep(kind, models),
    models,
    modelId: kind ? heldModel(kind, models, picked) : null,
    select,
  };
}
