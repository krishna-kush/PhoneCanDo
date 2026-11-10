// A new agent's Model step: whether a creation path asks it, and which
// pick holds. Pure (zero RN imports). It is asked only when the kind takes
// a local model (its KindView `models`) and a model on this phone passes
// the RAM gate; the agent's own setup (null) is the default, and a pick
// that the kind or the phone cannot take falls back to it.
import type { KindView } from '../../../../../agents/kit/ts/contract/view.ts';
import type { AgentKindId } from '../../../engine/agents/registry';
import type { LocalModel, ModelId, RamCheck } from '../../../engine/models/types';

/** What a creation path makes: the kind, and the local model it runs on (null: the agent's own setup). */
export type AgentPick = { kindId: AgentKindId; modelId: ModelId | null };

type KindLike = Pick<KindView, 'models'>;
type ModelLike = Pick<LocalModel, 'id' | 'ram'>;

/** The RAM gate: a model this phone can serve (a tight one too, and one whose chosen context passes the budget). */
export function runsHere(ram: Pick<RamCheck, 'verdict'>): boolean {
  return ram.verdict === 'fits' || ram.verdict === 'tight' || ram.verdict === 'over_budget';
}

/** Whether a new agent of [kind] gets the Model step with [models] on the phone. */
export function hasModelStep(kind: KindLike, models: readonly ModelLike[]): boolean {
  return kind.models.length > 0 && models.some((m) => runsHere(m.ram));
}

/** The model a pick holds: [picked] while the step shows and it is a model that runs here, else null. */
export function heldModel(kind: KindLike, models: readonly ModelLike[], picked: ModelId | null): ModelId | null {
  if (picked == null || !hasModelStep(kind, models)) return null;
  return models.some((m) => m.id === picked && runsHere(m.ram)) ? picked : null;
}
