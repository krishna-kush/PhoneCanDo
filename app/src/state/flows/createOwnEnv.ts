// An Own env: any registry image the user picked, downloaded once (native
// falls back to mirrors when Docker Hub limits us), then a first agent of the
// chosen kind on it. Each run is noted in ownEnvRuns, so the download page
// can follow it.
import type { Agent } from '../../engine/agents/records';
import type { AgentKindId } from '../../engine/agents/registry';
import { createRegistryEnv, retryEnv } from '../../engine/linux/native';
import type { EnvId } from '../../engine/linux/types';
import { track } from '../../engine/telemetry';
import { useLinuxStore } from '../linux';
import { createAgentFromEnv } from './createAgentFromEnv';
import { soleKindFor } from './kindOffers';
import { failureOfError } from './logic/errors';
import { ownEnvKind, setOwnEnvKind, setOwnEnvRun } from './ownEnvRuns';
import { jobIdOf, waitForTarget } from './waitForTarget';

export type OwnEnvStarted = { jobId: string; envId: EnvId };

/**
 * Starts the download and tells the caller its env (for the progress page),
 * waits for it, then makes the first agent. Rejects with the failure's code;
 * once started, the run in ownEnvRuns says the same.
 */
export async function createOwnEnv(
  ref: { image: string; tag: string },
  kindId: AgentKindId,
  onStarted?: (started: OwnEnvStarted) => void,
): Promise<Agent | null> {
  const linux = useLinuxStore.getState();
  linux.hydrateLinux();
  const since = useLinuxStore.getState().seq;
  const started = await createRegistryEnv(ref.image, ref.tag);
  setOwnEnvKind(started.envId, kindId);
  setOwnEnvRun(started.envId, { phase: 'downloading' });
  linux.refreshLinux();
  onStarted?.(started);
  return finishRun(started.envId, started.jobId, since);
}

/**
 * Retry on the download page: resumes the download, then makes the first
 * agent like createOwnEnv, of the kind picked then. After a restart that
 * pick is gone: the agent is made only when one kind is all this env can
 * offer, else the env offers New agent here.
 */
export async function retryOwnEnv(envId: EnvId, onStarted?: () => void): Promise<Agent | null> {
  const since = useLinuxStore.getState().seq;
  const jobId = jobIdOf(await retryEnv(envId));
  setOwnEnvRun(envId, { phase: 'downloading' });
  useLinuxStore.getState().refreshLinux();
  onStarted?.();
  return finishRun(envId, jobId, since);
}

async function finishRun(envId: EnvId, jobId: string | null, since: number): Promise<Agent | null> {
  try {
    await waitForTarget({ kind: 'env', id: envId }, jobId, since);
  } catch (e) {
    setOwnEnvRun(envId, { phase: 'failed', during: 'download', failure: failureOfError(e) });
    throw e;
  }
  track('env.add');
  const kindId = ownEnvKind(envId) ?? soleKindAfterDownload(envId);
  if (!kindId) {
    setOwnEnvRun(envId, { phase: 'downloaded' });
    return null;
  }
  setOwnEnvRun(envId, { phase: 'making-agent' });
  try {
    const agent = await createAgentFromEnv(envId, kindId);
    setOwnEnvRun(envId, { phase: 'done', agentId: agent.id });
    return agent;
  } catch (e) {
    setOwnEnvRun(envId, { phase: 'failed', during: 'agent', failure: failureOfError(e) });
    throw e;
  }
}

// The env's record as it reads now the download is done (its OS detected).
function soleKindAfterDownload(envId: EnvId): AgentKindId | null {
  useLinuxStore.getState().refreshLinux();
  const env = useLinuxStore.getState().envs.find((e) => e.id === envId);
  return env ? soleKindFor(env) : null;
}
