import { useState } from 'react';
import { XStack, YStack } from 'tamagui';
import type { Agent } from '../../../engine/agents/records';
import { cancelJob } from '../../../engine/linux/native';
import type { Env, Image } from '../../../engine/linux/types';
import { retryOwnEnv } from '../../../state/flows/createOwnEnv';
import { useOwnEnvRun } from '../../../state/flows/ownEnvRuns';
import { removeEnv } from '../../../state/flows/rowActions';
import { useTargetProgress } from '../../../state/linux';
import AppButton from '../../common/AppButton';
import ConfirmDialog from '../../common/ConfirmDialog';
import PlainText from '../../common/PlainText';
import RowFrame from '../../common/rows/RowFrame';
import RowGroup from '../../common/rows/RowGroup';
import SectionTitle from '../../common/SectionTitle';
import { useSlidInList } from '../../nav/slidIn';
import { linuxFailureText, recordErrorText } from '../logic/errorText';
import { formatBytes } from '../logic/format';
import { agentCountOf, type EnvRow } from '../logic/sections';
import { downloadLine, stepFraction } from '../logic/steps';
import { useNewAgent } from '../new-agent/useNewAgent';
import Note from '../parts/Note';
import ProgressBar from '../parts/ProgressBar';
import MachineRow from './MachineRow';

// Agent rows drawn as the page opens; the rest come once it has slid in.
const FIRST_SCREEN_ROWS = 6;

type Props = {
  env: Env | null;
  rows: EnvRow<Image, Agent>[];
  /** False on play and in builds without Linux: no new Linux machines. */
  linuxAvailable: boolean;
  onOpenAgent: (agentId: string) => void;
  /** The env was deleted: its page closes. */
  onDeleted: () => void;
};

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

// One system's page body: its download (progress and Cancel, or why it
// stopped and Retry), the agents on it (each machine a row of one group,
// with every agent that shares it, and New agent here, on a machine of its
// own, as the last row), then Delete system, offered only once no machine
// comes from it.
export default function EnvSection({ env, rows, linuxAvailable, onOpenAgent, onDeleted }: Props) {
  const progress = useTargetProgress(env ? { kind: 'env', id: env.id } : null);
  const [busy, setBusy] = useState<'retry' | 'delete' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const newAgentHere = useNewAgent();
  const shown = useSlidInList(rows, FIRST_SCREEN_ROWS);

  const run = (what: 'retry' | 'delete', job: () => Promise<unknown>) => {
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
  // Opens the agent's page itself, or Choose agent when there is a choice.
  const newAgent = () => env && newAgentHere.start({ kind: 'env', envId: env.id });
  // A failed download has no machines yet: once it is done, the first agent is made like New env does.
  const retry = () =>
    env && run('retry', () => new Promise<void>((resolve, reject) => void retryOwnEnv(env.id, resolve).catch(reject)));
  const failedWhy = env?.state === 'failed' ? recordErrorText(env) : null;
  const agents = agentCountOf(rows);

  return (
    <>
      {env?.state === 'downloading' ? (
        <YStack gap="2">
          <ProgressBar
            label={progress ? downloadLine(progress) : 'Downloading'}
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
        <YStack gap="2">
          <Note tone="error">{`The download stopped.${failedWhy ? ` ${failedWhy}` : ''}`}</Note>
          {canRetry ? (
            <AppButton variant="secondary" loading={busy === 'retry'} onPress={retry}>
              Retry download
            </AppButton>
          ) : null}
        </YStack>
      ) : null}

      {error ? <Note tone="error">{error}</Note> : null}
      {newAgentHere.error ? <Note tone="error">{newAgentHere.error}</Note> : null}

      <RowGroup title={agents === 1 ? '1 agent on it' : `${agents} agents on it`}>
        {shown.map((r) => (
          <RowFrame key={r.key} bare>
            <MachineRow image={r.image} agents={r.agents} onOpen={onOpenAgent} />
          </RowFrame>
        ))}
        {makingFirst && rows.length === 0 ? (
          <RowFrame>
            <ProgressBar label="Making its first agent" fraction={null} />
          </RowFrame>
        ) : null}
        {rows.length === 0 && !makingFirst ? (
          <RowFrame>
            <Note>{canAddAgent ? 'No agents here yet.' : 'No agents here.'}</Note>
          </RowFrame>
        ) : null}
        {canAddAgent ? (
          <RowFrame press={{ onPress: newAgent, role: 'button', label: 'New agent here' }} dim={newAgentHere.busy}>
            <XStack alignItems="center" gap="3">
              <PlainText fontFamily="mono" fontSize={18} color="primary" width={25} textAlign="center">
                +
              </PlainText>
              <PlainText fontFamily="mono" fontSize={12} letterSpacing={1.2} textTransform="uppercase">
                {newAgentHere.busy ? 'Making a new agent…' : 'New agent here'}
              </PlainText>
            </XStack>
          </RowFrame>
        ) : null}
      </RowGroup>

      {env && machines === 0 ? (
        <>
          <SectionTitle>Delete</SectionTitle>
          <AppButton variant="danger" loading={busy === 'delete'} onPress={() => setConfirmDelete(true)}>
            Delete system
          </AppButton>
          <ConfirmDialog
            open={confirmDelete}
            onClose={() => setConfirmDelete(false)}
            title="Delete this system?"
            message={deleteMessage(env)}
            onConfirm={() => {
              setConfirmDelete(false);
              run('delete', () => removeEnv(env.id).then(onDeleted));
            }}
          />
        </>
      ) : null}
    </>
  );
}
