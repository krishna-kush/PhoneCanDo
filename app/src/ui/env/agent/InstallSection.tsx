import type { Agent } from '../../../engine/agents/records';
import { agentKind } from '../../../engine/agents/registry';
import type { Image } from '../../../engine/linux/types';
import { useAppStore } from '../../../state/app';
import { installAgent } from '../../../state/flows/installAgent';
import { useInstallRun } from '../../../state/flows/installRuns';
import AppButton from '../../common/AppButton';
import PlainText from '../../common/PlainText';
import { versionLine } from '../logic/installText';
import InstallStatus from '../parts/InstallStatus';
import Note from '../parts/Note';

type Props = { agent: Agent; image: Image | undefined };

// The agent's install page body, for a kind with an install: the agent
// installed inside its own machine (its runtimes, packages and itself). The
// version it recorded, the run in progress or how it stopped (Retry) with
// its log filling the rest of the page, Install when it never finished, and
// Update agent once installed. Between runs, Last install log opens the log
// the machine kept (it outlives the app). Nothing for a kind without an
// install.
export default function InstallSection({ agent, image }: Props) {
  const run = useInstallRun(agent.id);
  const push = useAppStore((s) => s.push);
  const kind = agentKind(agent.kind);
  if (!kind.hasInstall) return null;

  const running = run?.status === 'running';
  const installed = !agent.needsInstall && agent.installedVersion != null;

  return (
    <>
      {installed ? (
        <PlainText fontFamily="mono" fontSize={13} color="dim" userSelect="text">
          {versionLine(agent.installedVersion ?? '')}
        </PlainText>
      ) : null}
      <InstallStatus agent={agent} image={image} fill />
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
      {!running ? (
        <AppButton variant="ghost" onPress={() => push({ name: 'agent-install-log', agentId: agent.id })}>
          Last install log
        </AppButton>
      ) : null}
    </>
  );
}
