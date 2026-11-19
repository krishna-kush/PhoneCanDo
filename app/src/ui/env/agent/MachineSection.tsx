import type { Agent } from '../../../engine/agents/records';
import { agentKind } from '../../../engine/agents/registry';
import type { Env, Image } from '../../../engine/linux/types';
import { useAppStore } from '../../../state/app';
import { kindLevelNow, useChecksStore } from '../../../state/checks';
import { useMessagesStore } from '../../../state/messages';
import AppButton from '../../common/AppButton';
import AppCard from '../../common/AppCard';
import { useDesk, useRoom } from '../../common/desk/useDesk';
import RowFrame from '../../common/rows/RowFrame';
import RowGroup from '../../common/rows/RowGroup';
import { unreadText } from '../../messages/logic/messagesCopy';
import AgentLine from '../list/AgentLine';
import SystemLogo from '../list/SystemLogo';
import { deskNote } from '../logic/deskText';
import { formatBytes } from '../logic/format';
import { missingToolsLine, notPackagedLine } from '../logic/hints';
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
// logo, as on Systems), its room (state/desks.ts) and how desk codes are
// given, the detected OS, its size, every agent on a machine
// agents share (this one first, the others open their pages; each says
// whether it is working now and its unread messages, or that it can't
// read them at its kind's level now), its setup
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
  const unread = useMessagesStore((s) => s.unread);
  const levels = useChecksStore((s) => s.levels);
  const room = useRoom(image?.id);
  const desk = useDesk(agent.id);

  if (!image) {
    return (
      <Note tone="error">Its machine is missing. Delete this agent and make a new one.</Note>
    );
  }

  const os = linux ? osLine(image.os ?? env?.os ?? null) : "Android's own shell";
  const size = image.sizeBytes > 0 ? formatBytes(image.sizeBytes) : null;
  const missing = tools?.missingTools ?? [];
  const install = tools?.installCommand ?? null;
  // Missing tools its OS doesn't package: left out of the install command.
  const notPackaged = tools?.notPackaged ?? [];
  const unknownManager = !install && notPackaged.length < missing.length;

  const title = env ? envTitle(env.source) : 'Unknown env';
  const openAgent = (agentId: string) => push({ name: 'agent', agentId });

  return (
    <>
      <AppCard
        title={title}
        subtitle={[room, os, size].filter(Boolean).join(' · ') || undefined}
        icon={env ? <SystemLogo keys={logoKeys(env)} size={32} /> : undefined}
        chevron={false}
      />
      <Note>{deskNote(room, desk)}</Note>
      {mates.length > 0 ? (
        <>
          <RowGroup title={machineAgentsTitle(mates.length + 1)} barcode="machineAgents">
            {onMachine.map((a) => (
              <RowFrame key={a.id} bare>
                <AgentLine
                  agent={a}
                  missing={false}
                  size={null}
                  label={agentKind(a.kind).label}
                  idle={idle[a.id] ?? null}
                  extra={kindLevelNow(levels, a.kind) === 'none' ? "can't read messages" : unreadText(unread[a.id] ?? 0)}
                  onOpen={a.id === agent.id ? null : openAgent}
                />
              </RowFrame>
            ))}
          </RowGroup>
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
          ) : null}
          {notPackaged.length > 0 ? <Note>{notPackagedLine(notPackaged)}</Note> : null}
          {unknownManager ? (
            <Note>We don't know its package manager, so install them by hand in a terminal.</Note>
          ) : null}
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
