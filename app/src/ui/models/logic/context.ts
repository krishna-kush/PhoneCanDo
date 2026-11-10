// A model's context in words, and the Context setting's slider. Pure (zero
// RN imports). k is 1024 tokens, as model makers write it: 16k is 16,384,
// 256k is 262,144.
import type { Agent, EngineStatus } from '../../../engine/agents/records';
import type { ContextRange, LocalModel } from '../../../engine/models/types';

/** 16_384 → "16k", 262_144 → "256k", 40_000 → "39k"; under 1024, the count. */
export function contextText(tokens: number): string {
  if (!Number.isFinite(tokens) || tokens <= 0) return '';
  return tokens < 1024 ? String(Math.round(tokens)) : `${Math.round(tokens / 1024)}k`;
}

type ContextFields = Pick<LocalModel, 'servedContext' | 'contextLength' | 'contextChoice'>;

/**
 * "Context 48k of 256k: reduced so it runs well on this phone": only when we picked it (automatic) and it is less
 * than the model was trained for; '' otherwise.
 */
export function reducedLine(m: ContextFields): string {
  if (m.contextChoice != null || m.contextLength == null || !(m.servedContext < m.contextLength)) return '';
  return `Context ${contextText(m.servedContext)} of ${contextText(m.contextLength)}: reduced so it runs well on this phone`;
}

/** The Context button: "Context: auto" or "Context: 64k". */
export function contextButtonText(m: Pick<LocalModel, 'contextChoice'>): string {
  return m.contextChoice == null ? 'Context: auto' : `Context: ${contextText(m.contextChoice)}`;
}

/**
 * What Automatic means, with what it gives now: memory free at a start decides. While the server runs on
 * automatic, its own context is the answer (the memory it holds is not free, so autoContext reads low then).
 */
export function automaticNote(m: Pick<LocalModel, 'autoContext' | 'serving' | 'servedContext' | 'contextChoice'>): string {
  const now = m.serving && m.contextChoice == null ? `running with ${contextText(m.servedContext)}` : contextText(m.autoContext);
  return `The most this phone can spare when the model starts, from the memory free then: ${now} now.`;
}

/** What choosing means: "From 16k to 256k. More context takes more RAM." */
export function chooseNote(r: ContextRange): string {
  return `From ${contextText(r.min)} to ${contextText(r.max)}. More context takes more RAM.`;
}

/** The other cost of a big context: agents keep longer chats, and a chat read again from the start takes longer. */
export const SPEED_NOTE =
  'More context lets an agent keep a longer chat before it shortens it. Reading a long chat again from the start (after a restart, or when another request pushed it out) can take many minutes on a phone.';

/** Whether there is anything to choose: a model trained for more than the floor. */
export function canChoose(r: ContextRange): boolean {
  return r.max > r.min && r.step > 0;
}

/** The slider's last position: whole steps from min, the last one up to max. */
export function lastStop(r: ContextRange): number {
  return canChoose(r) ? Math.ceil((r.max - r.min) / r.step) : 0;
}

/** The context at slider position [stop]. */
export function contextAt(r: ContextRange, stop: number): number {
  const i = Math.min(lastStop(r), Math.max(0, Math.round(Number.isFinite(stop) ? stop : 0)));
  return Math.min(r.min + i * r.step, r.max);
}

/** The slider position nearest [context]. */
export function stopOf(r: ContextRange, context: number): number {
  if (!canChoose(r) || !(context > r.min)) return 0;
  if (context >= r.max) return lastStop(r);
  return Math.min(lastStop(r), Math.round((context - r.min) / r.step));
}

/** The names of the agents on [modelId] whose engine is starting or running: a save restarts them. */
export function runningOn(
  modelId: string,
  agents: readonly Pick<Agent, 'id' | 'name' | 'model'>[],
  statuses: Readonly<Record<string, Pick<EngineStatus, 'state'> | undefined>>,
): string[] {
  return agents
    .filter((a) => a.model === modelId && (statuses[a.id]?.state === 'starting' || statuses[a.id]?.state === 'ready'))
    .map((a) => a.name);
}

/** Under Save while agents run on the model: "Saving restarts Main and Work, which run on this model." */
export function restartNote(names: string[]): string {
  if (names.length === 0) return '';
  const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  return `Saving restarts ${list}, which ${names.length === 1 ? 'runs' : 'run'} on this model.`;
}
