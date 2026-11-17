import { useMemo, useState } from 'react';
import { YStack } from 'tamagui';
import type { AgentId } from '../../../engine/agents/records';
import type { Schedule } from '../../../engine/schedule/types';
import { useAgentsStore } from '../../../state/agents';
import AppButton from '../../common/AppButton';
import ConfirmDialog from '../../common/ConfirmDialog';
import PageHeader from '../../common/PageHeader';
import Spot from '../../common/spot/Spot';
import { useNow } from '../../common/time/useNow';
import FormScreen from '../../env/custom-agents/FormScreen';
import Note from '../../env/parts/Note';
import { usePageActive } from '../../nav/pageActive';
import AgentLine from '../AgentLine';
import { type Draft, draftOf, draftProblems, type Field as FieldName, newDraft, patchOf, withChat } from '../logic/draft';
import {
  AGENT_SET_NOTE,
  BOARD_LABEL,
  CANCEL,
  CHAT_LABEL,
  DELETE,
  DELETE_MESSAGE,
  DELETE_TITLE,
  editorTitle,
  FOR_LABEL,
  OFF_NOTE,
  RUN_NOW,
  TASK_HINT,
  TASK_LABEL,
  ticketTag,
  WHEN_LABEL,
} from '../logic/editorCopy';
import { faceCue } from '../logic/faceCue';
import { boardTiming } from '../logic/nextRuns';
import { NO_AGENTS, saveLabel, SCHEDULES_TITLE } from '../logic/scheduleCopy';
import { useScheduleAgents } from '../useScheduleAgents';
import AgentPicker from './AgentPicker';
import ChatTiles from './ChatTiles';
import ComingUp from './ComingUp';
import Field from './Field';
import TaskField from './TaskField';
import Ticket from './Ticket';
import { useScheduleActions } from './useScheduleActions';
import WhenFields from './WhenFields';

type Props = {
  /** The one to change; null for a new one. */
  schedule: Schedule | null;
  /** The page is for this agent: a new one is for it. */
  agentId: AgentId | null;
  onDone: () => void;
};

/** How often the board's "in 14 h" moves on. */
const TICK_MS = 30_000;

// A schedule's form, in the Schedules page, as a work order handed to an
// agent (Ticket): who it is for (a new one picks from the agents whose
// kind can run schedules, as the drawer shows them), the task, when, the
// runs coming up, and which chat; then Save, and for one already there
// Run now and Delete. Problems show under their fields once you have
// tried to save. The agent's face reads along as you write the task and
// is pleased as the order is stamped filed (faceCue). The form scrolls so
// the field you type in stays above the keyboard; the board moves on with
// the clock while the page is in front.
export default function ScheduleEditor({ schedule, agentId, onDone }: Props) {
  const runners = useScheduleAgents();
  const agents = useAgentsStore((s) => s.agents);
  const now = useNow(usePageActive(), TICK_MS);
  const [draft, setDraft] = useState<Draft>(() => {
    const at = Date.now();
    if (schedule) return draftOf(schedule, at);
    const only = runners.length === 1 ? runners[0].id : null;
    return newDraft(agentId && runners.some((a) => a.id === agentId) ? agentId : only, at);
  });
  const [tried, setTried] = useState(false);
  const [doomed, setDoomed] = useState(false);
  const [writing, setWriting] = useState(false);
  const actions = useScheduleActions(schedule, onDone);

  // The clock as it is, as the save checks it (the board's moves every half minute).
  const problems = tried ? draftProblems(draft, Date.now()) : [];
  const of = (field: FieldName) => problems.filter((p) => p.field === field).map((p) => p.text);
  const dirty = useMemo(() => {
    if (!schedule) return false;
    const patch = patchOf(schedule, draft, Date.now());
    return patch == null || Object.keys(patch).length > 0;
  }, [schedule, draft]);
  const agent = schedule ? (agents.find((a) => a.id === schedule.agentId) ?? null) : null;
  const timing = boardTiming(draft, schedule?.timing ?? null, now);
  const face = faceCue(actions.stamp?.word ?? null, writing);
  const hop = actions.stamp?.key ?? 0;

  const save = async () => {
    setTried(true);
    await actions.save(draft);
  };

  return (
    <FormScreen>
      <PageHeader kicker={schedule ? (agent?.name ?? schedule.agentId) : SCHEDULES_TITLE} title={editorTitle(schedule != null)} />
      {schedule?.by === 'agent' ? <Note>{AGENT_SET_NOTE}</Note> : null}
      {schedule && !schedule.on ? <Note>{OFF_NOTE}</Note> : null}

      <YStack gap="3" pointerEvents={actions.closing ? 'none' : 'auto'}>
        <Ticket tag={ticketTag(schedule?.id ?? null)} stamp={actions.stamp}>
          {schedule ? (
            <Field label={FOR_LABEL}>
              <AgentLine agentId={schedule.agentId} agent={agent} size={28} {...face} hop={hop} />
            </Field>
          ) : runners.length > 0 ? (
            <AgentPicker
              agents={runners}
              value={draft.agentId}
              onPick={(id) => setDraft({ ...draft, agentId: id })}
              problems={of('agent')}
              face={face}
              hop={hop}
            />
          ) : (
            <Field label={FOR_LABEL}>
              <Note>{NO_AGENTS}</Note>
            </Field>
          )}

          <Field label={TASK_LABEL} hint={TASK_HINT} problems={of('text')}>
            <TaskField value={draft.text} onChange={(text) => setDraft({ ...draft, text })} onWriting={setWriting} />
          </Field>

          <Field label={WHEN_LABEL}>
            <WhenFields draft={draft} onChange={setDraft} now={now} timing={timing} problems={[...of('time'), ...of('every')]} />
          </Field>

          <Field label={BOARD_LABEL}>
            <ComingUp timing={timing} now={now} />
          </Field>

          <Field label={CHAT_LABEL}>
            <ChatTiles value={draft.chat} onPick={(chat) => setDraft(withChat(draft, chat))} />
          </Field>
        </Ticket>

        {actions.note ? <Note tone={actions.note.error ? 'error' : 'muted'}>{actions.note.text}</Note> : null}
        <Spot id={schedule ? null : 'schedules.save'}>
          <AppButton onPress={save} loading={actions.busy === 'save'} disabled={!schedule && runners.length === 0}>
            {saveLabel(schedule != null)}
          </AppButton>
        </Spot>
        {schedule ? (
          <AppButton variant="secondary" onPress={() => actions.runNow(dirty)} loading={actions.busy === 'run'}>
            {RUN_NOW}
          </AppButton>
        ) : null}
        <AppButton variant="ghost" onPress={onDone}>
          {CANCEL}
        </AppButton>
        {schedule ? (
          <AppButton variant="danger" onPress={() => setDoomed(true)} loading={actions.busy === 'delete'}>
            {DELETE}
          </AppButton>
        ) : null}
      </YStack>

      <ConfirmDialog
        open={doomed}
        onClose={() => setDoomed(false)}
        title={DELETE_TITLE}
        message={DELETE_MESSAGE}
        onConfirm={() => {
          setDoomed(false);
          void actions.remove();
        }}
      />
    </FormScreen>
  );
}
