import { useEffect, useState } from 'react';
import { cancelJob } from '../../../engine/linux/native';
import { useAgentsStore } from '../../../state/agents';
import { useAppStore } from '../../../state/app';
import { retryOwnEnv } from '../../../state/flows/createOwnEnv';
import { useOwnEnvRun } from '../../../state/flows/ownEnvRuns';
import { removeEnv } from '../../../state/flows/rowActions';
import { useLinuxStore, useTargetProgress } from '../../../state/linux';
import ActionDeck from '../../common/actions/ActionDeck';
import AppCard from '../../common/AppCard';
import PageHeader from '../../common/PageHeader';
import Screen from '../../common/Screen';
import { failureText, linuxFailureText, recordErrorText } from '../logic/errorText';
import { isPaused } from '../logic/titles';
import SystemDownload from '../list/SystemDownload';
import { useNewAgent } from '../new-agent/useNewAgent';
import Note from '../parts/Note';
import ProgressBar from '../parts/ProgressBar';

// Own env, the download. Leaving keeps it going (the drawer and the
// systems list show it too). The run started on the confirm page makes the
// agent once the download is done; this page then opens that agent in its
// place. Pause keeps what it fetched for Resume; a failed download offers
// Retry or deleting the env; a failed agent
// (or none made: a Retry after a restart with a choice of agent), New agent
// here.
export default function PullProgress({ repo, tag, envId }: { repo: string; tag: string; envId: string }) {
  const finishCreation = useAppStore((s) => s.finishCreation);
  const env = useLinuxStore((s) => s.envs.find((e) => e.id === envId));
  const hasMachine = useLinuxStore((s) => s.images.some((i) => i.envId === envId));
  const progress = useTargetProgress({ kind: 'env', id: envId });
  const run = useOwnEnvRun(envId);
  const [busy, setBusy] = useState<'retry' | 'delete' | null>(null);
  const newAgentHere = useNewAgent();
  const [error, setError] = useState<string | null>(null);

  // The run made the agent: show it.
  const madeAgentId = run?.phase === 'done' ? run.agentId : null;
  const madeAgentExists = useAgentsStore((s) => madeAgentId != null && s.agents.some((a) => a.id === madeAgentId));
  useEffect(() => {
    if (madeAgentId && madeAgentExists) finishCreation({ name: 'agent', agentId: madeAgentId, fresh: true });
  }, [madeAgentId, madeAgentExists, finishCreation]);

  const act = (what: 'retry' | 'delete', job: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(what);
    setError(null);
    job()
      .catch((e: unknown) => setError(linuxFailureText(e)))
      .finally(() => setBusy(null));
  };

  // Busy only until the download restarts; from then on the run and the record say how it goes.
  const retry = () =>
    act('retry', () => new Promise<void>((resolve, reject) => void retryOwnEnv(envId, resolve).catch(reject)));
  const remove = () => act('delete', () => removeEnv(envId).then(() => finishCreation({ name: 'systems' })));

  // The run moves on a moment after the record reads ready.
  const making = env?.state === 'ready' && (run?.phase === 'downloading' || run?.phase === 'making-agent');
  // Ready, but no run will make its agent (it failed, or the app restarted since).
  const needsAgent = env?.state === 'ready' && !making && !hasMachine;
  const agentFailure = run?.phase === 'failed' && run.during === 'agent' ? failureText(run.failure) : null;
  const paused = env != null && isPaused(env);
  const failed = env?.state === 'failed' && !paused;
  const downloadFailure = failed ? recordErrorText(env) : null;

  return (
    <Screen>
      <PageHeader kicker="new agent · download" title={paused ? 'Paused' : 'Downloading'} />
      <AppCard title={`${repo}:${tag}`} subtitle="Own env" chevron={false} />

      {!env ? <Note>This download is gone.</Note> : null}

      {env?.state === 'downloading' ? (
        <>
          <SystemDownload env={env} />
          <Note>You can leave this page; the download keeps going, and the menu and the systems list show it.</Note>
        </>
      ) : null}

      {env && paused ? (
        <>
          <SystemDownload env={env} />
          <Note>Paused. What it fetched stays on the phone; Resume carries on from there.</Note>
        </>
      ) : null}

      {making ? <ProgressBar label="Downloaded. Making the agent's machine" fraction={null} /> : null}

      {needsAgent ? (
        <Note tone={agentFailure ? 'error' : 'muted'}>
          {agentFailure ? `Downloaded, but the agent wasn't made. ${agentFailure}` : 'Downloaded.'}
        </Note>
      ) : null}

      {env?.state === 'ready' && hasMachine && !making ? <Note>Downloaded. Its agents are in the menu.</Note> : null}

      {failed ? <Note tone="error">{`The download stopped.${downloadFailure ? ` ${downloadFailure}` : ''}`}</Note> : null}

      {error ? <Note tone="error">{error}</Note> : null}
      {newAgentHere.error ? <Note tone="error">{newAgentHere.error}</Note> : null}
      <ActionDeck
        barcode="deckDownload"
        actions={[
          paused && { label: 'Resume', role: 'go', loading: busy === 'retry', onPress: retry },
          failed && { label: 'Retry', role: 'go', loading: busy === 'retry', onPress: retry },
          needsAgent && { label: 'New agent here', role: 'go', loading: newAgentHere.busy, onPress: () => newAgentHere.start({ kind: 'env', envId }) },
          env?.state === 'downloading' && progress && { label: 'Pause', onPress: () => cancelJob(progress.jobId) },
          { label: 'See this system', role: 'back', onPress: () => finishCreation({ name: 'system', envId }) },
          paused && { label: 'Delete this download', role: 'danger', loading: busy === 'delete', onPress: remove },
          failed && { label: 'Delete this env', role: 'danger', loading: busy === 'delete', onPress: remove },
        ]}
      />
    </Screen>
  );
}
