import { type ReactNode, useMemo } from 'react';
import { XStack } from 'tamagui';
import type { AgentId } from '../../engine/agents/records';
import { agentKind } from '../../engine/agents/registry';
import type { Schedule } from '../../engine/schedule/types';
import { useAgentsStore } from '../../state/agents';
import { useAppStore } from '../../state/app';
import { useScheduleStore } from '../../state/schedule';
import { useAgentLook } from '../common/face/useAgentLook';
import PageHeader from '../common/PageHeader';
import type { BarcodeId } from '../common/rows/barcode/lines';
import RowFrame from '../common/rows/RowFrame';
import RowGroup from '../common/rows/RowGroup';
import Screen from '../common/Screen';
import Spot from '../common/spot/Spot';
import { useNow } from '../common/time/useNow';
import TextAction, { REACH as TEXT_REACH } from '../drawer/select/TextAction';
import Note from '../env/parts/Note';
import { usePageActive } from '../nav/pageActive';
import LateRunsRow from './LateRunsRow';
import {
  cannotRunText,
  emptyText,
  NO_AGENTS,
  NOT_IN_BUILD,
  NOT_RUNNING,
  RECENT_RUNS,
  SCHEDULES_INTRO,
  SCHEDULES_TITLE,
} from './logic/scheduleCopy';
import PageClock from './clock/PageClock';
import EmptySchedules from './empty/EmptySchedules';
import { runsFor, type TimelineEntry, timeline } from './logic/timeline';
import RecentRuns from './RecentRuns';
import ScheduleRow from './ScheduleRow';
import { useScheduleAgents } from './useScheduleAgents';

/** The recent runs shown under the list. */
const RUNS_SHOWN = 20;
/** How often "next in 12 min" moves on. */
const TICK_MS = 30_000;

type Props = {
  agentId: AgentId | null;
  onAdd: () => void;
  onEdit: (s: Schedule) => void;
};

// The Schedules page's list: the intro, the line about late runs while
// Android's exact alarms are off, then one timeline across agents (on a
// page for one agent, just its own): what still runs, soonest first under
// a heading per day, then what is off or done; then what the recent runs
// did. Each row names its agent as the drawer does, and the live alarm
// clock (clock/) stands at the foot. Add opens the editor for an agent
// that can run schedules; with none, a line says so. With nothing to
// list, the empty box (empty/). The times move on while the page is in
// front.
export default function ScheduleList({ agentId, onAdd, onEdit }: Props) {
  const active = usePageActive();
  const now = useNow(active, TICK_MS);
  const available = useScheduleStore((s) => s.available);
  const schedules = useScheduleStore((s) => s.schedules);
  const runs = useScheduleStore((s) => s.runs);
  const exact = useScheduleStore((s) => s.exact);
  const agents = useAgentsStore((s) => s.agents);
  const runners = useScheduleAgents();

  const line = useMemo(() => timeline(schedules, agents, agentId, now), [schedules, agents, agentId, now]);
  const empty = line.days.length === 0 && line.rest.length === 0;
  const shownRuns = useMemo(() => runsFor(runs, agentId, RUNS_SHOWN), [runs, agentId]);
  const agent = agentId ? (agents.find((a) => a.id === agentId) ?? null) : null;
  const canAdd = available && (agentId ? runners.some((a) => a.id === agentId) : runners.length > 0);
  let cannot: string | null = null;
  if (available && agent && !canAdd) cannot = cannotRunText(agentKind(agent.kind).label);
  else if (available && !agentId && runners.length === 0) cannot = NO_AGENTS;

  return (
    <Screen>
      <Head agentId={agentId} canAdd={canAdd} onAdd={onAdd} />
      <Note>{SCHEDULES_INTRO}</Note>
      {!available ? <Note>{NOT_IN_BUILD}</Note> : null}
      {available && exact === false ? <LateRunsRow /> : null}
      {cannot ? <Note>{cannot}</Note> : null}
      {line.days.map((day) => (
        <Rows key={day.label} title={day.label} barcode={day.barcode} entries={day.entries} now={now} onEdit={onEdit} />
      ))}
      {line.rest.length > 0 ? <Rows title={NOT_RUNNING} barcode="schedulesOff" entries={line.rest} now={now} onEdit={onEdit} /> : null}
      {available && empty ? (
        <EmptySchedules text={emptyText(agentId ? (agent?.name ?? 'this agent') : null)} canAdd={canAdd} onAdd={onAdd} still={!active} now={now} />
      ) : null}
      {shownRuns.length > 0 ? <RecentRuns title={RECENT_RUNS} runs={shownRuns} now={now} withAgent={agentId == null} /> : null}
      {available && !empty ? <PageClock still={!active} /> : null}
    </Screen>
  );
}

// One day's schedules (or those not running) as a RowGroup.
function Rows({
  title,
  barcode,
  entries,
  now,
  onEdit,
}: {
  title: string;
  barcode: BarcodeId;
  entries: readonly TimelineEntry[];
  now: number;
  onEdit: (s: Schedule) => void;
}) {
  return (
    <RowGroup title={title} barcode={barcode}>
      {entries.map((e) => (
        <RowFrame key={e.schedule.id} bare>
          <ScheduleRow entry={e} now={now} onEdit={onEdit} />
        </RowFrame>
      ))}
    </RowGroup>
  );
}

// The page's head: the agent it is for (its desk and name) with All for
// every agent's, or every agent's; Add while there is an agent to add for.
function Head({ agentId, canAdd, onAdd }: { agentId: AgentId | null; canAdd: boolean; onAdd: () => void }) {
  const replaceTop = useAppStore((s) => s.replaceTop);
  const add = canAdd ? (
    <Spot id="schedules.add" reach={TEXT_REACH}>
      <TextAction label="Add" onPress={onAdd} />
    </Spot>
  ) : null;
  if (!agentId) return <PageHeader kicker="All agents" title={SCHEDULES_TITLE} trailing={add} />;
  return (
    <AgentHead
      agentId={agentId}
      trailing={
        <XStack gap="5" alignItems="center">
          <TextAction label="All" onPress={() => replaceTop({ name: 'schedules' })} />
          {add}
        </XStack>
      }
    />
  );
}

function AgentHead({ agentId, trailing }: { agentId: AgentId; trailing: ReactNode }) {
  const name = useAgentsStore((s) => s.agents.find((a) => a.id === agentId)?.name ?? null);
  const { desk } = useAgentLook(agentId);
  const kicker = [desk, name].filter(Boolean).join(' · ');
  return <PageHeader kicker={kicker} title={SCHEDULES_TITLE} trailing={trailing} />;
}
