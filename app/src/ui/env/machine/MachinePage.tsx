import { useState } from 'react';
import { agentKind } from '../../../engine/agents/registry';
import { freeDiskBytes } from '../../../engine/files';
import { useAppStore } from '../../../state/app';
import { useDesk, useRoom } from '../../common/desk/useDesk';
import PageHeader from '../../common/PageHeader';
import Screen from '../../common/Screen';
import SystemMark from '../list/SystemMark';
import { envTitle } from '../logic/titles';
import ImageStatus from '../parts/ImageStatus';
import Note from '../parts/Note';
import DeleteSection from './delete/DeleteSection';
import { ANDROID_MACHINE_NOTE, insideFailedLine, NO_SYSTEMD, NOT_A_SANDBOX } from './logic/copy';
import { machineGlance } from './logic/glance';
import { machineTools, whoNeeds } from './logic/machineTools';
import { upgradeCommand } from './logic/upgrade';
import InspectionTag from './inspection/InspectionTag';
import MachineAgents from './MachineAgents';
import MachineControls from './MachineControls';
import ResetSection from './reset/ResetSection';
import ToolNotes from './ToolNotes';
import { useInside } from './useInside';
import { useMachineRecords } from './useMachineRecords';
import { useMeasure } from './useMeasure';
import { commandsOf, useMissingTools } from './useMissingTools';

// The system's logo's side beside the page's title, as on a system's page.
const LOGO = 48;

// One machine, everything about it on one page: the only place its
// details show. Opened from an agent's page (`agentId`: that agent, first
// and marked in its list, whose terminal, install log and reinstall it
// shows) or from the machine's line on its system's page (the oldest agent
// on it stands in). Its system's logo by the title, its setup state, its
// Controls (MachineControls), its agents as its system's page lists them
// (MachineAgents), its inspection tag (what it is, its space and its tools
// at a glance: inspection/), the plain truths (not a sandbox, no systemd)
// and last its Danger zone: Reset (reset/), or Delete for a machine no
// agent uses (delete/). Opening the page measures the machine, looks
// inside and checks the tools; Check again does all three again.
export default function MachinePage({ imageId, agentId }: { imageId: string; agentId?: string }) {
  const { image, env, linux, agents } = useMachineRecords(imageId);
  const openLinuxTerminal = useAppStore((s) => s.openLinuxTerminal);
  const here = agents.find((a) => a.id === agentId) ?? null;
  const lead = here ?? agents[0] ?? null;
  const desk = useDesk(here?.id ?? '');
  const room = useRoom(image?.id);
  const [again, setAgain] = useState(0);

  const readyLinux = linux && image?.state === 'ready' ? image.id : null;
  const family = (image?.os ?? env?.os)?.family ?? null;
  const tools = useMissingTools(agents, image, linux, again);
  const measuring = useMeasure(readyLinux, again);
  const inside = useInside(lead?.id ?? null, readyLinux, again);
  const phoneFree = freeDiskBytes();

  const kicker = here
    ? `${desk} · ${here.name}`
    : [env ? envTitle(env.source) : null, room].filter(Boolean).join(' · ') || 'machine';
  const header = <PageHeader kicker={kicker} title="Machine" trailing={<SystemMark env={env ?? null} size={LOGO} />} />;
  if (!image) {
    return (
      <Screen>
        {header}
        <Note tone={here ? 'error' : undefined}>
          {here ? 'Its machine is missing. Delete this agent and make a new one.' : 'This machine is gone.'}
        </Note>
      </Screen>
    );
  }

  const read = inside.read.state === 'read' ? inside.read : null;
  const commands = [...new Set(agents.flatMap(commandsOf))];
  const labels = agents.map((a) => agentKind(a.kind).label);
  const now = Date.now();
  const install = tools?.installCommand ?? null;

  return (
    <Screen>
      {header}
      <ImageStatus image={image} />
      <MachineControls
        agentId={lead?.id ?? null}
        logAgentId={(lead && agentKind(lead.kind).hasInstall ? lead : agents.find((a) => agentKind(a.kind).hasInstall))?.id ?? null}
        linux={linux}
        ready={image.state === 'ready'}
        installCommand={install}
        upgradeCommand={upgradeCommand(family)}
        checking={measuring || inside.reading}
        onCheck={() => setAgain((n) => n + 1)}
      />
      <MachineAgents image={image} agents={agents} here={here?.id ?? null} room={room} desk={here ? desk : null} />
      <InspectionTag
        glance={machineGlance({ image, env: env ?? null, linux, inside: read?.inside ?? null, phoneFree, now })}
        tools={linux ? machineTools(commands, tools?.missingTools ?? null, read?.inside.tools ?? null) : []}
        who={whoNeeds(labels)}
        linux={linux}
        onInstall={lead && install && image.state === 'ready' ? () => openLinuxTerminal(lead.id, install) : null}
        readAt={read?.at ?? null}
      />
      {inside.read.state === 'failed' ? <Note tone="error">{insideFailedLine(inside.read.message)}</Note> : null}
      <ToolNotes tools={tools} />
      {linux ? (
        <>
          <Note>{NOT_A_SANDBOX}</Note>
          <Note>{NO_SYSTEMD}</Note>
        </>
      ) : (
        <Note>{ANDROID_MACHINE_NOTE}</Note>
      )}
      {!lead ? <DeleteSection image={image} /> : linux ? <ResetSection agent={lead} image={image} env={env} /> : null}
    </Screen>
  );
}
