import { useEffect, useState } from 'react';
import { cancelJob } from '../../../engine/linux/native';
import { useAgentsStore } from '../../../state/agents';
import { retryOwnEnv } from '../../../state/flows/createOwnEnv';
import { useOwnEnvRun } from '../../../state/flows/ownEnvRuns';
import { removeEnv } from '../../../state/flows/rowActions';
import { useLinuxStore, useTargetProgress } from '../../../state/linux';
import AppButton from '../../common/AppButton';
import AppCard from '../../common/AppCard';
import Screen from '../../common/Screen';
import { failureText, linuxFailureText, recordErrorText } from '../logic/errorText';
import { progressLine, stepFraction } from '../logic/steps';
import { useNewAgent } from '../new-agent/useNewAgent';
import { useEnvNav } from '../nav';
import Note from '../parts/Note';
import PageHeader from '../parts/PageHeader';
import ProgressBar from '../parts/ProgressBar';

// Own env, the download. Leaving keeps it going (the list shows it too).
// The run started on the confirm page makes the first agent once the
// download is done; this page then opens that agent. A failed download
// offers Retry or deleting the env; a failed agent (or none made: a Retry
// after a restart with a choice of agent), New agent here.
export default function PullProgress({ repo, tag, envId }: { repo: string; tag: string; envId: string }) {
  const open = useEnvNav((s) => s.open);
  const back = useEnvNav((s) => s.back);
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
    if (madeAgentId && madeAgentExists) open({ name: 'agent', agentId: madeAgentId });
  }, [madeAgentId, madeAgentExists, open]);

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
  const remove = () => act('delete', () => removeEnv(envId).then(() => open({ name: 'list' })));

  // The run moves on a moment after the record reads ready.
  const making = env?.state === 'ready' && (run?.phase === 'downloading' || run?.phase === 'making-agent');
  // Ready, but no run will make its agent (it failed, or the app restarted since).
  const needsAgent = env?.state === 'ready' && !making && !hasMachine;
  const agentFailure = run?.phase === 'failed' && run.during === 'agent' ? failureText(run.failure) : null;
  const downloadFailure = env?.state === 'failed' ? recordErrorText(env) : null;

  return (
    <Screen>
      <PageHeader title="Downloading" onBack={back} />
      <AppCard title={`${repo}:${tag}`} subtitle="Own env" chevron={false} />

      {!env ? <Note>This download is gone.</Note> : null}

      {env?.state === 'downloading' ? (
        <>
          <ProgressBar
            label={progress ? progressLine(progress.step, progress.done, progress.total) : 'Starting'}
            fraction={progress ? stepFraction(progress.step, progress.done, progress.total) : null}
          />
          <Note>You can leave this page; the download keeps going and the Env list shows it.</Note>
          {progress ? (
            <AppButton variant="secondary" onPress={() => cancelJob(progress.jobId)}>
              Cancel download
            </AppButton>
          ) : null}
        </>
      ) : null}

      {making ? <ProgressBar label="Downloaded. Making the agent's machine" fraction={null} /> : null}

      {needsAgent ? (
        <>
          <Note tone={agentFailure ? 'error' : 'muted'}>
            {agentFailure ? `Downloaded, but the agent wasn't made. ${agentFailure}` : 'Downloaded.'}
          </Note>
          <AppButton loading={newAgentHere.busy} onPress={() => newAgentHere.start({ kind: 'env', envId })}>
            New agent here
          </AppButton>
        </>
      ) : null}

      {env?.state === 'ready' && hasMachine && !making ? <Note>Downloaded. Its agents are in the Env list.</Note> : null}

      {env?.state === 'failed' ? (
        <>
          <Note tone="error">{`The download stopped.${downloadFailure ? ` ${downloadFailure}` : ''}`}</Note>
          <AppButton loading={busy === 'retry'} onPress={retry}>
            Retry
          </AppButton>
          <AppButton variant="secondary" loading={busy === 'delete'} onPress={remove}>
            Delete this env
          </AppButton>
        </>
      ) : null}

      {error ? <Note tone="error">{error}</Note> : null}
      {newAgentHere.error ? <Note tone="error">{newAgentHere.error}</Note> : null}
      <AppButton variant="ghost" onPress={() => open({ name: 'list' })}>
        Back to the list
      </AppButton>
    </Screen>
  );
}
