// Where each Own env's "download, then first agent" run is, by env id, so
// the download page can follow a run it did not start (the user left and
// came back) and say what failed after the download. In memory only: after
// a restart the env's record says enough (a ready env without agents offers
// "New agent here").
import { create } from 'zustand';
import type { AgentId } from '../../engine/agents/records';
import type { EnvId } from '../../engine/linux/types';
import type { JobFailure } from './logic/errors';

export type OwnEnvRun =
  | { phase: 'downloading' }
  | { phase: 'making-agent' }
  | { phase: 'done'; agentId: AgentId }
  | { phase: 'failed'; during: 'download' | 'agent'; failure: JobFailure };

const useOwnEnvRuns = create<{ runs: Record<EnvId, OwnEnvRun> }>(() => ({ runs: {} }));

export function setOwnEnvRun(envId: EnvId, run: OwnEnvRun): void {
  useOwnEnvRuns.setState((s) => ({ runs: { ...s.runs, [envId]: run } }));
}

export function useOwnEnvRun(envId: EnvId): OwnEnvRun | undefined {
  return useOwnEnvRuns((s) => s.runs[envId]);
}
