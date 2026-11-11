import { useAgentsStore } from '../../state/agents';
import { useMemoryStore } from '../../state/memory';
import { useModelsStore } from '../../state/models';
import { toldText } from './logic/memoryCopy';
import { UNKNOWN_AGENT } from './logic/memoryRows';

/** The line after an automatic stop (who went to sleep and why); null when there is none to tell. */
export function useToldLine(): string | null {
  const told = useMemoryStore((s) => s.told);
  const agents = useAgentsStore((s) => s.agents);
  const models = useModelsStore((s) => s.models);
  if (!told) return null;
  return toldText(
    told.agentIds.map((id) => agents.find((a) => a.id === id)?.name ?? UNKNOWN_AGENT),
    told.modelIds.map((id) => models.find((m) => m.id === id)?.name ?? 'a local model'),
  );
}
