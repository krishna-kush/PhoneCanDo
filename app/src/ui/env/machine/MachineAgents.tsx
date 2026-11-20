import type { Agent, AgentId } from '../../../engine/agents/records';
import type { Image } from '../../../engine/linux/types';
import { useAppStore } from '../../../state/app';
import RowFrame from '../../common/rows/RowFrame';
import RowGroup from '../../common/rows/RowGroup';
import MachineRow from '../list/MachineRow';
import { deskNote } from '../logic/deskText';
import { agentsOnItTitle, SHARED_MACHINE_NOTE } from '../logic/sharedMachineText';
import Note from '../parts/Note';
import { useMachineActivity } from './useMachineActivity';

type Props = {
  image: Image;
  /** Every agent on it, oldest first. */
  agents: readonly Agent[];
  /** The agent the page was opened from: first, marked, not opened. */
  here: AgentId | null;
  /** "room 2"; null before it has one. */
  room: string | null;
  /** "desk 2a": that agent's; null when the page was opened from its system. */
  desk: string | null;
};

// The agents on the machine, as its system's page lists them (MachineRow:
// the machine's line over its agents, the others opening their pages), each
// running one saying whether it is working now. Then, on a shared machine,
// what its agents share, and how room and desk codes are given.
export default function MachineAgents({ image, agents, here, room, desk }: Props) {
  const push = useAppStore((s) => s.push);
  const idle = useMachineActivity(agents.map((a) => a.id));
  const ordered = [...agents].sort((a, b) => (a.id === here ? -1 : b.id === here ? 1 : 0));

  return (
    <>
      <RowGroup title={agentsOnItTitle(agents.length)} barcode="machineAgents">
        <RowFrame bare>
          <MachineRow
            image={image}
            agents={ordered}
            here={here}
            idle={idle}
            status={false}
            onOpen={(agentId) => push({ name: 'agent', agentId })}
          />
        </RowFrame>
      </RowGroup>
      {agents.length > 1 ? <Note>{SHARED_MACHINE_NOTE}</Note> : null}
      {agents.length > 0 ? <Note>{deskNote(room, desk)}</Note> : null}
    </>
  );
}
