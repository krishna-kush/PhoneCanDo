// Which agent a walk goes with. Say hi and the terminal walk through an
// agent's own screens (its chat, its menu, its page), and the guide knows
// only the default kind's (opencode's: its web UI's spots are in its
// manifest), so those two go with that kind's agent: the active one when it
// is one, else the first there is; with none, the active agent as it is.
// The other walks go through the app's own screens, the same whoever is
// active. Pure (zero RN imports).
import type { MissionId } from '../../../../state/logic/starter/missions.ts';

/** The missions whose walk goes through an agent's own screens. */
export const ON_AGENT: readonly MissionId[] = ['hello', 'terminal'];

/** The agent [mission]'s walk goes with, among [agents] with [activeId] active; null for a walk through the app's own screens. */
export function walkAgent<Id extends string>(
  mission: MissionId,
  agents: readonly { id: Id; kind: string }[],
  activeId: Id | null,
  isDefault: (kind: string) => boolean,
): Id | null {
  if (!ON_AGENT.includes(mission)) return null;
  const active = agents.find((a) => a.id === activeId);
  if (active && isDefault(active.kind)) return active.id;
  return agents.find((a) => isDefault(a.kind))?.id ?? activeId;
}
