import { YStack } from 'tamagui';
import type { Agent } from '../../../engine/agents/records';
import { agentKind } from '../../../engine/agents/registry';
import type { Env, Image } from '../../../engine/linux/types';
import { useAppStore } from '../../../state/app';
import AppButton from '../../common/AppButton';
import AppCard from '../../common/AppCard';
import SectionTitle from '../../common/SectionTitle';
import AgentLine from '../list/AgentLine';
import SystemLogo from '../list/SystemLogo';
import { formatBytes } from '../logic/format';
import { missingToolsLine } from '../logic/hints';
import { logoKeys } from '../logic/osLogo';
import { machineAgentsTitle, SHARED_MACHINE_NOTE } from '../logic/sharedMachineText';
import { envTitle, osLine } from '../logic/titles';
import ImageStatus from '../parts/ImageStatus';
import Note from '../parts/Note';
import { useMachineActivity } from './useMachineActivity';
import { useMachineMates } from './useMachineMates';
import { useMissingTools } from './useMissingTools';

type Props = { agent: Agent; image: Image | undefined; env: Env | undefined; linux: boolean };

// The agent's machine page body: which env it comes from (with its OS's
// logo, as on Systems), the detected OS, its size, every agent on a machine
// agents share (this one first, the others open their pages; each says
// whether it is working now), its setup
// state, commands the agent's kind needs but the machine lacks (checked
// when the page shows it, with the install command typed into a terminal,
// not run), and the plain truths: not a sandbox, no systemd.
export default function MachineSection({ agent, image, env, linux }: Props) {
  const push = useAppStore((s) => s.push);
  const openLinuxTerminal = useAppStore((s) => s.openLinuxTerminal);
  const tools = useMissingTools(agent, image, linux);
  const mates = useMachineMates(agent);
  const onMachine = [agent, ...mates];
  const idle = useMachineActivity(mates.length > 0 ? onMachine.map((a) => a.id) : []);

  if (!image) {
    return (
      <Note tone="error">Its machine is missing. Delete this agent and make a new one.</Note>
    );
  }

  const os = linux ? osLine(image.os ?? env?.os ?? null) : "Android's own shell";
  const size = image.sizeBytes > 0 ? formatBytes(image.sizeBytes) : null;
  const missing = tools?.missingTools ?? [];
  const install = tools?.installCommand ?? null;

  const title = env ? envTitle(env.source) : 'Unknown env';
  const openAgent = (agentId: string) => push({ name: 'agent', agentId });

  return (
    <>
      <AppCard
        title={title}
        subtitle={[os, size].filter(Boolean).join(' · ') || undefined}
        icon={env ? <SystemLogo keys={logoKeys(env)} letter={title.charAt(0).toUpperCase()} size={32} /> : undefined}
        chevron={false}
      />
      {mates.length > 0 ? (
        <>
          <SectionTitle>{machineAgentsTitle(mates.length + 1)}</SectionTitle>
          <YStack borderWidth={1} borderColor="line" backgroundColor="panel">
            {onMachine.map((a, i) => (
              <YStack key={a.id} borderTopWidth={i > 0 ? 1 : 0} borderColor="line">
                <AgentLine
                  agent={a}
                  missing={false}
                  size={null}
                  label={agentKind(a.kind).label}
                  idle={idle[a.id] ?? null}
                  onOpen={a.id === agent.id ? null : openAgent}
                />
              </YStack>
            ))}
          </YStack>
          <Note>{SHARED_MACHINE_NOTE}</Note>
        </>
      ) : null}
      <ImageStatus image={image} />
      {missing.length > 0 ? (
        <>
          <Note>{missingToolsLine(missing)}</Note>
          {install ? (
            <>
              <AppButton variant="secondary" onPress={() => openLinuxTerminal(agent.id, install)}>
                Open terminal with the install command
              </AppButton>
              <Note>The command is typed in for you; press Enter to run it.</Note>
            </>
          ) : (
            <Note>We don't know its package manager, so install them by hand in a terminal.</Note>
          )}
        </>
      ) : null}
      {linux ? (
        <>
          <Note>Not a security sandbox: what runs here can reach the network and this app's files.</Note>
          <Note>systemd doesn't run here, so start services by hand.</Note>
        </>
      ) : null}
    </>
  );
}
