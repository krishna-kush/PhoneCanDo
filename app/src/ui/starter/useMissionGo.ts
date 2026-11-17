import { useState } from 'react';
import { agentKind } from '../../engine/agents/registry';
import { copyText } from '../../engine/sharing';
import { useAgentsStore } from '../../state/agents';
import { useAppStore } from '../../state/app';
import type { MissionId } from '../../state/logic/starter/missions';
import { useStarterStore } from '../../state/starter';
import { COPIED, COPY_FAILED } from './copy';
import { walkAgent } from './walk/logic/walkAgent';

// What a mission's button does: it never jumps there. Home comes back and
// the walk starts (walk/), pointing at each thing to tap on the way, so you
// learn the way by going it. Say hi and the terminal go with the agent the
// guide knows (walk/logic/walkAgent.ts), switched to first if another is
// active. Say hi copies its dare first; the terminal's command goes along
// with the walk and is typed in (no Enter) when the terminal opens. `note`
// says how a copy went.
export function useMissionGo() {
  const goHome = useAppStore((s) => s.goHome);
  const [note, setNote] = useState<string | null>(null);

  const copy = (dare: string) => setNote(copyText(dare) ? COPIED : COPY_FAILED);

  const go = (id: MissionId, dare: string | null) => {
    setNote(null);
    if (id === 'hello' && dare) copy(dare);
    const agents = useAgentsStore.getState();
    const agentId = walkAgent(id, agents.agents, agents.activeAgentId, (kind) => agentKind(kind).isDefault);
    const switched = agentId != null && agentId !== agents.activeAgentId;
    if (switched) void agents.setActiveAgent(agentId);
    useStarterStore.getState().startWalk(id, id === 'terminal' ? dare : null, agentId, switched);
    goHome();
  };

  return { go, copy, note };
}
