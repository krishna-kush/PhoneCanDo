// Where each Own env's "download, then first agent" run is, by env id, so
// the download page can follow a run it did not start (the user left and
// came back) and say what failed after the download; and which kind (and
// model) the first agent is, so a Retry makes the one picked. In memory
// only: after a restart the env's record says enough (a ready env without
// agents offers "New agent here").
import { create } from 'zustand';
import type { AgentId } from '../../engine/agents/records';
import type { EnvId } from '../../engine/linux/types';
import type { JobFailure } from './logic/errors';
import type { AgentPick } from './logic/modelStep';

export type OwnEnvRun =
  | { phase: 'downloading' }
  | { phase: 'making-agent' }
  | { phase: 'done'; agentId: AgentId }
  /** Downloaded with no kind to make (a Retry after a restart, with a choice to ask): New agent here. */
  | { phase: 'downloaded' }
  | { phase: 'failed'; during: 'download' | 'agent'; failure: JobFailure };

type OwnEnvRuns = { runs: Record<EnvId, OwnEnvRun>; picks: Record<EnvId, AgentPick> };

const useOwnEnvRuns = create<OwnEnvRuns>(() => ({ runs: {}, picks: {} }));

export function setOwnEnvRun(envId: EnvId, run: OwnEnvRun): void {
  useOwnEnvRuns.setState((s) => ({ runs: { ...s.runs, [envId]: run } }));
}

export function useOwnEnvRun(envId: EnvId): OwnEnvRun | undefined {
  return useOwnEnvRuns((s) => s.runs[envId]);
}

/** The kind (and model) picked for the env's first agent. */
export function setOwnEnvPick(envId: EnvId, pick: AgentPick): void {
  useOwnEnvRuns.setState((s) => ({ picks: { ...s.picks, [envId]: pick } }));
}

export function ownEnvPick(envId: EnvId): AgentPick | null {
  return useOwnEnvRuns.getState().picks[envId] ?? null;
}
