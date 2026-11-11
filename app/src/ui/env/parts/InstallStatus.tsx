import { YStack } from 'tamagui';
import type { Agent } from '../../../engine/agents/records';
import { agentKind } from '../../../engine/agents/registry';
import type { Image } from '../../../engine/linux/types';
import { installAgent } from '../../../state/flows/installAgent';
import { useInstallRun } from '../../../state/flows/installRuns';
import AppButton from '../../common/AppButton';
import { installActivityLines, installDoneLine, installFailureText, installLine } from '../logic/installText';
import LogTail from './LogTail';
import Note from './Note';
import ProgressBar from './ProgressBar';
import StatusLines from './StatusLines';

type Props = { agent: Agent; image: Image | undefined };

// An agent's install where it matters: the run's phase, bar, what it is
// doing (a retry, a download, the time so far) and last log lines while it
// runs; where it stopped, why, its lines and Retry when it
// failed; a word when it just finished; Install when it needs one and none
// ran since the app started. Shared by the agent page, its Install page and Home.
export default function InstallStatus({ agent, image }: Props) {
  const run = useInstallRun(agent.id);
  const label = agentKind(agent.kind).label;
  const ready = image?.state === 'ready';

  if (run?.status === 'running') {
    return (
      <YStack gap="$2">
        <ProgressBar label={installLine(run, label)} fraction={run.fraction} />
        <StatusLines lines={installActivityLines(run)} />
        <LogTail lines={run.tail} />
      </YStack>
    );
  }
  if (run?.status === 'failed') {
    return (
      <YStack gap="$2">
        <Note tone="error">{installFailureText(run, label)}</Note>
        <LogTail lines={run.tail} />
        <AppButton variant="secondary" onPress={() => void installAgent(agent.id, run.mode)}>
          Retry
        </AppButton>
      </YStack>
    );
  }
  if (run?.status === 'done' && !agent.needsInstall) return <Note>{installDoneLine(run, label)}</Note>;
  if (!agent.needsInstall) return null;
  return (
    <YStack gap="$2">
      <Note>{ready ? 'Not installed yet.' : 'It installs once its machine is ready.'}</Note>
      <AppButton disabled={!ready} onPress={() => void installAgent(agent.id)}>
        {`Install ${label}`}
      </AppButton>
    </YStack>
  );
}
