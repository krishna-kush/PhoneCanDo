// A new agent on its machine, as every creation path makes it: of the kind
// picked, named after it ("opencode", then "opencode 2" and so on), on the
// local model picked for it, set as the agent page's Model section sets it
// (agentModel.ts). Whether a path asks for that model is the Model step
// (logic/modelStep.ts) over the kinds and the models on this phone.
import type { Agent } from '../../engine/agents/records';
import { agentKind, type AgentKindId } from '../../engine/agents/registry';
import { createAgent, deleteAgent, EngineStartFailure, listAgents } from '../../engine/engines';
import type { ImageId } from '../../engine/linux/types';
import { useAgentsStore } from '../agents';
import { useModelsStore } from '../models';
import { chooseAgentModel } from './agentModel';
import { hasModelStep, type AgentPick } from './logic/modelStep';
import { nextAgentName } from './logic/names';

/** Whether a new agent of this kind gets the Model step on this phone now. */
export function asksForModel(kindId: AgentKindId): boolean {
  const models = useModelsStore.getState();
  if (!models.hydrated) models.hydrateModels();
  return hasModelStep(agentKind(kindId), useModelsStore.getState().models);
}

/**
 * Makes the agent on [imageId]. A model that cannot be set takes the agent
 * back out and rejects with why (an EngineStartFailure), so a creation
 * makes what was picked or nothing; the image stays the caller's.
 */
export async function makeAgent(imageId: ImageId, pick: AgentPick): Promise<Agent> {
  const kind = agentKind(pick.kindId);
  const agent = createAgent({
    kind: kind.id,
    name: nextAgentName(kind.label, listAgents().map((a) => a.name)),
    imageId,
  });
  if (pick.modelId == null) return agent;
  const set = await chooseAgentModel(agent.id, pick.modelId);
  if (set.ok) return agent;
  await deleteAgent(agent.id).catch(() => false);
  useAgentsStore.getState().refreshAgents();
  throw new EngineStartFailure(set.code, set.message);
}
