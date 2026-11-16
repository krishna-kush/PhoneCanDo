import type { AgentId } from '../../../engine/agents/records';
import type { ImageId } from '../../../engine/linux/types';
import { useDesksStore } from '../../../state/desks';
import { deskLabel, roomLabel } from '../../../state/logic/desks';

/** An agent's desk as it reads beside its name: "desk 1b". */
export function useDesk(agentId: AgentId): string {
  return useDesksStore((s) => deskLabel(s.desks.seats[agentId]));
}

/** A machine's room as it reads on its rows: "room 1"; null before it has an agent. */
export function useRoom(imageId: ImageId | null | undefined): string | null {
  return useDesksStore((s) => roomLabel(imageId ? s.desks.rooms[imageId] : null));
}
