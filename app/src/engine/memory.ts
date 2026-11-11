// The runner's memory guard (contract: NativeMemoryStatus): how close the
// phone is to running out of memory, what each running agent and loaded
// local model takes, the countdown to the runner stopping one agent by
// itself (never the one on screen; idle ones first, least recently used
// first) and what it stopped last. Native sends it on every change of level
// or countdown and about every 5 s while the level is not ok. A native build
// from before the guard reads as ok with nothing in it.
import type {
  NativeAutoStop,
  NativeMemoryAgent,
  NativeMemoryLevel,
  NativeMemoryModel,
  NativeMemoryStatus,
} from '../../modules/phonecando-runner/src/PhoneCanDoRunner.types';
import { isRunnerAvailable, nativeRunner, onRunnerEvent } from './runner';

export type MemoryLevel = NativeMemoryLevel;
export type MemoryAgent = NativeMemoryAgent;
export type MemoryModel = NativeMemoryModel;
export type AutoStop = NativeAutoStop;
export type MemoryStatus = NativeMemoryStatus;

/** Nothing to say: what a build without the guard reads as. */
export const MEMORY_OK: MemoryStatus = {
  level: 'ok',
  totalBytes: 0,
  availBytes: 0,
  warnBelowBytes: 0,
  stopAt: null,
  nextStopAgentId: null,
  agents: [],
  models: [],
  lastAutoStop: null,
};

const LEVELS: readonly string[] = ['ok', 'warn', 'critical'];

// Whatever native sends, in the shape the app reads: an unknown level is ok,
// a missing list is empty.
function asStatus(raw: NativeMemoryStatus | null | undefined): MemoryStatus {
  if (!raw || !LEVELS.includes(raw.level)) return MEMORY_OK;
  return {
    ...MEMORY_OK,
    ...raw,
    agents: Array.isArray(raw.agents) ? raw.agents : [],
    models: Array.isArray(raw.models) ? raw.models.map((m) => ({ ...m, agentIds: m.agentIds ?? [] })) : [],
    lastAutoStop: raw.lastAutoStop
      ? { ...raw.lastAutoStop, agentIds: raw.lastAutoStop.agentIds ?? [], modelIds: raw.lastAutoStop.modelIds ?? [] }
      : null,
  };
}

/** The guard's reading now; ok and empty where the module or the method is absent. */
export function memoryStatus(): MemoryStatus {
  if (!isRunnerAvailable()) return MEMORY_OK;
  try {
    const m = nativeRunner();
    return typeof m.memoryStatus === 'function' ? asStatus(m.memoryStatus()) : MEMORY_OK;
  } catch {
    return MEMORY_OK;
  }
}

/** Every reading native sends; a no-op subscription where the module is absent. */
export function onMemory(listener: (status: MemoryStatus) => void): { remove(): void } {
  return onRunnerEvent<NativeMemoryStatus>('phonecandoMemory', (e) => listener(asStatus(e)));
}
