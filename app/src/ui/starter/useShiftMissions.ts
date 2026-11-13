import { useMemo } from 'react';
import { getBuildChannel, isRunnerAvailable } from '../../engine/runner';
import { useActiveAgent } from '../../state/agents';
import { missionsFor, type MissionId } from '../../state/logic/starter/missions';
import { useModelsStore } from '../../state/models';
import { useScheduleStore } from '../../state/schedule';
import { useAgentRecords } from '../env/agent/useAgentRecords';
import { useScheduleAgents } from '../schedule/useScheduleAgents';
import type { StarterContext } from './copy';

function channel(): string {
  try {
    return isRunnerAvailable() ? getBuildChannel() : 'full';
  } catch {
    return 'full';
  }
}

export type ShiftMissions = {
  /** This phone's missions, in order. */
  missions: MissionId[];
  ctx: StarterContext;
  /** Phone control is in this build. */
  hands: boolean;
};

// The first shift's missions on this phone and what their words depend on:
// the build, whether the active agent's machine is Linux, local models, and
// whether an agent here can run a schedule. Schedules' reads start where
// the signals are heard (ShiftSignals.tsx).
export function useShiftMissions(): ShiftMissions {
  const agent = useActiveAgent();
  const { linux } = useAgentRecords(agent?.id ?? '');
  const models = useModelsStore((s) => s.device.supported);
  const schedulesOn = useScheduleStore((s) => s.available);
  const runners = useScheduleAgents().length;
  const build = channel();
  const schedules = schedulesOn && runners > 0;
  return useMemo(
    () => ({
      missions: missionsFor({ channel: build, schedules }),
      ctx: { linux, models },
      hands: build === 'full',
    }),
    [build, schedules, linux, models],
  );
}
