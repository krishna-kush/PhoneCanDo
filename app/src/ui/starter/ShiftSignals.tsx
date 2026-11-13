import { useEffect } from 'react';
import { AppState } from 'react-native';
import { isAccessibilityServiceEnabled, isUiAutomationConnected, onRunFinished } from '../../engine/runner';
import { useAgentsStore } from '../../state/agents';
import { useAppStore } from '../../state/app';
import type { MissionId } from '../../state/logic/starter/missions';
import { useScheduleStore } from '../../state/schedule';
import { useStarterStore } from '../../state/starter';
import { useShiftMissions } from './useShiftMissions';

function phoneControlOn(): boolean {
  try {
    return isUiAutomationConnected() || isAccessibilityServiceEnabled();
  } catch {
    return false;
  }
}

// The first shift's eyes, mounted once over Home (it draws nothing; App
// shows it only once an agent exists): each mission is ticked
// when the app sees it happen, shift on or not. Say hi: an agent's run
// finished well. The terminal: a terminal page opened. Hands: phone
// control's switch is on (read again on every return to the app, as the
// switch is flipped in Android's settings). A teammate: a second agent.
// Night shift: a schedule exists. Want hands? is ticked by its own button.
export default function ShiftSignals() {
  const { missions, hands } = useShiftMissions();
  const hydrated = useStarterStore((s) => s.hydrated);
  const agents = useAgentsStore((s) => s.agents.length);
  const schedules = useScheduleStore((s) => s.schedules.length);
  const terminalOpen = useAppStore((s) => s.pages.some((p) => p.route.name === 'terminal'));

  useEffect(() => {
    void useStarterStore.getState().hydrate();
    useScheduleStore.getState().refreshSchedules();
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const seen = (id: MissionId) => {
      if (missions.includes(id)) useStarterStore.getState().markDone(id, missions);
    };
    if (terminalOpen) seen('terminal');
    if (agents > 1) seen('teammate');
    if (schedules > 0) seen('schedule');
    if (hands && phoneControlOn()) seen('hands');

    const run = onRunFinished(() => seen('hello'));
    const app = AppState.addEventListener('change', (state) => {
      if (state === 'active' && hands && phoneControlOn()) seen('hands');
    });
    return () => {
      run.remove();
      app.remove();
    };
  }, [hydrated, missions, hands, terminalOpen, agents, schedules]);

  return null;
}
