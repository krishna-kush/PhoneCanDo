// Where each Own env's "download, then first agent" run is, by env id, so
// the download page can follow a run it did not start (the user left and
// came back) and say what failed after the download; and which kind the
// first agent is, so a Retry makes the one picked. In memory only: after a
// restart the env's record says enough (a ready env without agents offers
// "New agent here").
import { create } from 'zustand';
import type { AgentId } from '../../engine/agents/records';
import type { AgentKindId } from '../../engine/agents/registry';
import type { EnvId } from '../../engine/linux/types';
import type { JobFailure } from './logic/errors';

export type OwnEnvRun =
  | { phase: 'downloading' }
  | { phase: 'making-agent' }
  | { phase: 'done'; agentId: AgentId }
  /** Downloaded with no kind to make (a Retry after a restart, with a choice to ask): New agent here. */
  | { phase: 'downloaded' }
  | { phase: 'failed'; during: 'download' | 'agent'; failure: JobFailure };

type OwnEnvRuns = { runs: Record<EnvId, OwnEnvRun>; kinds: Record<EnvId, AgentKindId> };

const useOwnEnvRuns = create<OwnEnvRuns>(() => ({ runs: {}, kinds: {} }));

export function setOwnEnvRun(envId: EnvId, run: OwnEnvRun): void {
  useOwnEnvRuns.setState((s) => ({ runs: { ...s.runs, [envId]: run } }));
}

export function useOwnEnvRun(envId: EnvId): OwnEnvRun | undefined {
  return useOwnEnvRuns((s) => s.runs[envId]);
}

/** The kind picked for the env's first agent. */
export function setOwnEnvKind(envId: EnvId, kindId: AgentKindId): void {
  useOwnEnvRuns.setState((s) => ({ kinds: { ...s.kinds, [envId]: kindId } }));
}

export function ownEnvKind(envId: EnvId): AgentKindId | null {
  return useOwnEnvRuns.getState().kinds[envId] ?? null;
}
