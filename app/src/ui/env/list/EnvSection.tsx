import { useState } from 'react';
import { YStack } from 'tamagui';
import type { Agent } from '../../../engine/agents/records';
import { cancelJob } from '../../../engine/linux/native';
import type { Env, Image } from '../../../engine/linux/types';
import { createAgentFromEnv } from '../../../state/flows/createAgentFromEnv';
import { retryOwnEnv } from '../../../state/flows/createOwnEnv';
import { useOwnEnvRun } from '../../../state/flows/ownEnvRuns';
import { removeEnv } from '../../../state/flows/rowActions';
import { useTargetProgress } from '../../../state/linux';
import AppButton from '../../common/AppButton';
import AppCard, { type CardMenuItem } from '../../common/AppCard';
import ConfirmDialog from '../../common/ConfirmDialog';
import { linuxFailureText, recordErrorText } from '../logic/errorText';
import { formatBytes } from '../logic/format';
import type { EnvRow } from '../logic/sections';
import { progressLine, stepFraction } from '../logic/steps';
import { envTitle, osLine } from '../logic/titles';
import Note from '../parts/Note';
import ProgressBar from '../parts/ProgressBar';
import MachineRow from './MachineRow';

type Props = {
  env: Env | null;
  rows: EnvRow<Image, Agent>[];
  /** False on play and in builds without Linux: no new Linux machines. */
  linuxAvailable: boolean;
  onOpenAgent: (agentId: string) => void;
};

function envSubtitle(env: Env): string {
  if (env.state === 'downloading') return 'Downloading';
  if (env.state === 'failed') return 'Download stopped';
  const os = env.source.kind === 'android' ? "Android's own shell" : osLine(env.os);
  const size = env.sizeBytes > 0 ? formatBytes(env.sizeBytes) : null;
  return [os, size].filter(Boolean).join(' · ');
}

function deleteMessage(env: Env): string {
  switch (env.source.kind) {
    case 'registry':
      return env.sizeBytes > 0
        ? `Its download (${formatBytes(env.sizeBytes)}) goes. You can download it again any time.`
        : 'What it downloaded so far goes. You can download it again any time.';
    case 'default':
      return 'It is part of the app, so nothing is lost: it comes back when you pick Default again.';
    case 'android':
      return 'Nothing is stored for it; it comes back when an agent needs it.';
  }
}

// One env: its card (name, OS, size, ⋮ actions), its download state, then
// its machines. Delete env is offered only once no machine comes from it.
export default function EnvSection({ env, rows, linuxAvailable, onOpenAgent }: Props) {
  const progress = useTargetProgress(env ? { kind: 'env', id: env.id } : null);
  const [busy, setBusy] = useState<'new' | 'retry' | 'delete' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const run = (what: 'new' | 'retry' | 'delete', job: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(what);
    setError(null);
    job()
      .catch((e: unknown) => setError(linuxFailureText(e)))
      .finally(() => setBusy(null));
  };

  const ownRun = useOwnEnvRun(env?.id ?? '');
  // Downloaded, and the run that started it is making its first agent.
  const makingFirst = env?.state === 'ready' && (ownRun?.phase === 'downloading' || ownRun?.phase === 'making-agent');
  const machines = rows.filter((r) => r.image != null).length;
  const canAddAgent = env != null && env.state === 'ready' && (env.source.kind === 'android' || linuxAvailable);
  const canRetry = env?.state === 'failed' && env.source.kind === 'registry' && linuxAvailable;
  const newAgent = () => env && run('new', () => createAgentFromEnv(env.id).then((a) => onOpenAgent(a.id)));
  // A failed download has no machines yet: once it is done, the first agent is made like New env does.
  const retry = () =>
    env && run('retry', () => new Promise<void>((resolve, reject) => void retryOwnEnv(env.id, resolve).catch(reject)));

  const menu: CardMenuItem[] = [];
  if (env) {
    if (canAddAgent) menu.push({ label: 'New agent here', onSelect: newAgent });
    if (canRetry) menu.push({ label: 'Retry download', onSelect: retry });
    if (machines === 0) menu.push({ label: 'Delete env', danger: true, onSelect: () => setConfirmDelete(true) });
  }
  const failedWhy = env?.state === 'failed' ? recordErrorText(env) : null;

  return (
    <YStack gap="$2">
      {env ? (
        <AppCard
          title={envTitle(env.source)}
          subtitle={envSubtitle(env)}
          menu={menu}
          menuLabel={`Actions for ${envTitle(env.source)}`}
          chevron={false}
        />
      ) : (
        <AppCard title="Machines we can't place" subtitle="Their env or machine is missing" chevron={false} />
      )}

      {env?.state === 'downloading' ? (
        <YStack gap="$2">
          <ProgressBar
            label={progress ? progressLine(progress.step, progress.done, progress.total) : 'Downloading'}
            fraction={progress ? stepFraction(progress.step, progress.done, progress.total) : null}
          />
          {progress ? (
            <AppButton variant="secondary" onPress={() => cancelJob(progress.jobId)}>
              Cancel download
            </AppButton>
          ) : null}
        </YStack>
      ) : null}

      {env?.state === 'failed' ? (
        <YStack gap="$2">
          <Note tone="error">{`The download stopped.${failedWhy ? ` ${failedWhy}` : ''}`}</Note>
          {canRetry ? (
            <AppButton variant="secondary" loading={busy === 'retry'} onPress={retry}>
              Retry download
            </AppButton>
          ) : null}
        </YStack>
      ) : null}

      {error ? <Note tone="error">{error}</Note> : null}

      {rows.map((r) => (
        <MachineRow key={r.key} image={r.image} agent={r.agent} onOpen={onOpenAgent} />
      ))}

      {makingFirst && rows.length === 0 ? <ProgressBar label="Making its first agent" fraction={null} /> : null}

      {canAddAgent && rows.length === 0 && !makingFirst ? (
        <YStack gap="$2">
          <Note>No agents here yet.</Note>
          <AppButton variant="secondary" loading={busy === 'new'} onPress={newAgent}>
            New agent here
          </AppButton>
        </YStack>
      ) : null}

      {env ? (
        <ConfirmDialog
          open={confirmDelete}
          onClose={() => setConfirmDelete(false)}
          title="Delete this env?"
          message={deleteMessage(env)}
          onConfirm={() => {
            setConfirmDelete(false);
            run('delete', () => removeEnv(env.id));
          }}
        />
      ) : null}
    </YStack>
  );
}
