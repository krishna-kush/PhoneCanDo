import { Text } from 'tamagui';
import type { Agent } from '../../../engine/agents/records';
import { agentKind } from '../../../engine/agents/registry';
import type { Image } from '../../../engine/linux/types';
import { installAgent } from '../../../state/flows/installAgent';
import { useInstallRun } from '../../../state/flows/installRuns';
import AppButton from '../../common/AppButton';
import SectionTitle from '../../common/SectionTitle';
import { useTheme } from '../../common/globals';
import { versionLine } from '../logic/installText';
import InstallStatus from '../parts/InstallStatus';
import Note from '../parts/Note';

type Props = { agent: Agent; image: Image | undefined };

// A kind with an install: the agent installed inside its own machine (its
// runtimes, packages and itself). The version it recorded, the run in
// progress or how it stopped (Retry), Install when it never finished, and
// Update agent once installed. Nothing for a kind without an install.
export default function InstallSection({ agent, image }: Props) {
  const t = useTheme();
  const run = useInstallRun(agent.id);
  const kind = agentKind(agent.kind);
  if (!kind.hasInstall) return null;

  const running = run?.status === 'running';
  const installed = !agent.needsInstall && agent.installedVersion != null;

  return (
    <>
      <SectionTitle>Install</SectionTitle>
      {installed ? (
        <Text fontFamily="$mono" fontSize={13} color={t.dim} selectable>
          {versionLine(agent.installedVersion ?? '')}
        </Text>
      ) : null}
      <InstallStatus agent={agent} image={image} />
      {installed && !running ? (
        <>
          <AppButton
            variant="secondary"
            disabled={image?.state !== 'ready'}
            onPress={() => void installAgent(agent.id, 'update')}
          >
            Update agent
          </AppButton>
          <Note>An update stops the agent first.</Note>
        </>
      ) : null}
    </>
  );
}
