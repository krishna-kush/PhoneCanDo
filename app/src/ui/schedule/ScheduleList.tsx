import { Fragment, type ReactNode, useMemo, useState } from 'react';
import { XStack, YStack } from 'tamagui';
import type { AgentId } from '../../engine/agents/records';
import { agentKind } from '../../engine/agents/registry';
import type { Schedule } from '../../engine/schedule/types';
import { useAgentsStore } from '../../state/agents';
import { useAppStore } from '../../state/app';
import { useScheduleStore } from '../../state/schedule';
import AppButton from '../common/AppButton';
import { useAgentLook } from '../common/face/useAgentLook';
import PageHeader from '../common/PageHeader';
import Screen from '../common/Screen';
import SectionTitle from '../common/SectionTitle';
import TextAction from '../drawer/select/TextAction';
import Note from '../env/parts/Note';
import { usePageActive } from '../nav/pageActive';
import { ChoiceChips } from './editor/Chip';
import LateRunsRow from './LateRunsRow';
import {
  cannotRunText,
  emptyText,
  LAYOUT_LABELS,
  NO_AGENTS,
  NOT_IN_BUILD,
  NOT_RUNNING,
  RECENT_RUNS,
  saveLabel,
  SCHEDULES_INTRO,
  SCHEDULES_TITLE,
} from './logic/scheduleCopy';
import { runsFor, type TimelineEntry, timeline } from './logic/timeline';
import RecentRuns from './RecentRuns';
import ScheduleRow from './ScheduleRow';
import ScheduleRowTimeFirst from './ScheduleRowTimeFirst';
import { useNow } from './useNow';
import { useScheduleAgents } from './useScheduleAgents';

/** The recent runs shown under the list. */
const RUNS_SHOWN = 20;

type Props = {
  agentId: AgentId | null;
  onAdd: () => void;
  onEdit: (s: Schedule) => void;
};

type Layout = keyof typeof LAYOUT_LABELS;

// TEMPORARY: both row layouts behind a switch until we pick one; then the
// other row, this switch and its copy go.
const LAYOUTS = (['agent', 'time'] as const).map((value) => ({ value, label: LAYOUT_LABELS[value] }));

// The Schedules page's list: the intro, the line about late runs while
// Android's exact alarms are off, then one timeline across agents (on a
// page for one agent, just its own): what still runs, soonest first under
// a heading per day, then what is off or done; then what the recent runs
// did. Each row names its agent as the drawer does. Add opens the editor
// for an agent that can run schedules; with none, a line says so. The
// times move on while the page is in front.
export default function ScheduleList({ agentId, onAdd, onEdit }: Props) {
  const active = usePageActive();
  const now = useNow(active);
  const available = useScheduleStore((s) => s.available);
  const schedules = useScheduleStore((s) => s.schedules);
  const runs = useScheduleStore((s) => s.runs);
  const exact = useScheduleStore((s) => s.exact);
  const agents = useAgentsStore((s) => s.agents);
  const runners = useScheduleAgents();

  const [layout, setLayout] = useState<Layout>('agent');
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
      {empty ? null : <ChoiceChips<Layout> options={LAYOUTS} value={layout} onPick={setLayout} />}
      {line.days.map((day) => (
        <Fragment key={day.label}>
          <SectionTitle>{day.label}</SectionTitle>
          <Rows entries={day.entries} layout={layout} now={now} onEdit={onEdit} />
        </Fragment>
      ))}
      {line.rest.length > 0 ? (
        <>
          <SectionTitle>{NOT_RUNNING}</SectionTitle>
          <Rows entries={line.rest} layout={layout} now={now} onEdit={onEdit} />
        </>
      ) : null}
      {available && empty ? <Note>{emptyText(agentId ? (agent?.name ?? 'this agent') : null)}</Note> : null}
      {empty && canAdd ? <AppButton onPress={onAdd}>{saveLabel(false)}</AppButton> : null}
      {shownRuns.length > 0 ? (
        <>
          <SectionTitle>{RECENT_RUNS}</SectionTitle>
          <RecentRuns runs={shownRuns} now={now} withAgent={agentId == null} />
        </>
      ) : null}
    </Screen>
  );
}

// Rows in one box, a line between them.
function Rows({
  entries,
  layout,
  now,
  onEdit,
}: {
  entries: readonly TimelineEntry[];
  layout: Layout;
  now: number;
  onEdit: (s: Schedule) => void;
}) {
  const Row = layout === 'time' ? ScheduleRowTimeFirst : ScheduleRow;
  return (
    <YStack borderWidth={1} borderColor="line" backgroundColor="panel">
      {entries.map((e, i) => (
        <Fragment key={e.schedule.id}>
          {i > 0 ? <YStack height={1} backgroundColor="line" /> : null}
          <Row entry={e} now={now} onEdit={onEdit} />
        </Fragment>
      ))}
    </YStack>
  );
}

// The page's head: the agent it is for (its serial and name) with All for
// every agent's, or every agent's; Add while there is an agent to add for.
function Head({ agentId, canAdd, onAdd }: { agentId: AgentId | null; canAdd: boolean; onAdd: () => void }) {
  const replaceTop = useAppStore((s) => s.replaceTop);
  const add = canAdd ? <TextAction label="Add" onPress={onAdd} /> : null;
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
  const { serial } = useAgentLook(agentId);
  const kicker = [serial, name].filter(Boolean).join(' · ');
  return <PageHeader kicker={kicker} title={SCHEDULES_TITLE} trailing={trailing} />;
}
