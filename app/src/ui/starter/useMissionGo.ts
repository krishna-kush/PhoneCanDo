import { useState } from 'react';
import { copyText } from '../../engine/sharing';
import { useActiveAgent } from '../../state/agents';
import { useAppStore } from '../../state/app';
import type { MissionId } from '../../state/logic/starter/missions';
import { useStarterStore } from '../../state/starter';
import { useStartNewAgent } from '../env/new-agent/useStartNewAgent';
import { COPIED, COPY_FAILED } from './copy';

// Where each mission's button goes, with the dare it shows: Say hi copies
// the dare and opens the chat, the terminal opens with the command typed
// in (no Enter), Hands opens Settings (Phone control is on it), Want hands?
// opens Updates and counts as done, a teammate starts New agent, Night
// shift opens Schedules. `note` says how a copy went.
export function useMissionGo(missions: readonly MissionId[]) {
  const agent = useActiveAgent();
  const push = useAppStore((s) => s.push);
  const goHome = useAppStore((s) => s.goHome);
  const openLinuxTerminal = useAppStore((s) => s.openLinuxTerminal);
  const newAgent = useStartNewAgent();
  const [note, setNote] = useState<string | null>(null);

  const copy = (dare: string) => setNote(copyText(dare) ? COPIED : COPY_FAILED);

  const go = (id: MissionId, dare: string | null) => {
    setNote(null);
    switch (id) {
      case 'hello':
        if (dare) copy(dare);
        goHome();
        return;
      case 'terminal':
        if (agent) openLinuxTerminal(agent.id, dare ?? undefined);
        return;
      case 'hands':
        push({ name: 'settings' });
        return;
      case 'upgrade':
        useStarterStore.getState().markDone('upgrade', missions);
        push({ name: 'settings-page', page: 'updates' });
        return;
      case 'teammate':
        newAgent.start();
        return;
      case 'schedule':
        push({ name: 'schedules' });
        return;
    }
  };

  return { go, copy, note, busy: newAgent.busy, error: newAgent.error };
}
