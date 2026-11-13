import { useMemo, useState } from 'react';
import type { AgentId } from '../../../engine/agents/records';
import type { ChatMode, Schedule } from '../../../engine/schedule/types';
import { useAgentsStore } from '../../../state/agents';
import AppButton from '../../common/AppButton';
import AppInput from '../../common/AppInput';
import ConfirmDialog from '../../common/ConfirmDialog';
import PageHeader from '../../common/PageHeader';
import FormScreen from '../../env/custom-agents/FormScreen';
import Note from '../../env/parts/Note';
import { type Draft, draftOf, draftProblems, type Field as FieldName, newDraft, patchOf, withChat } from '../logic/draft';
import {
  AGENT_LABEL,
  AGENT_SET_NOTE,
  CANCEL,
  CHAT_LABEL,
  chatLabel,
  chatNote,
  DELETE,
  DELETE_MESSAGE,
  DELETE_TITLE,
  editorTitle,
  NO_AGENTS,
  OFF_NOTE,
  RUN_NOW,
  saveLabel,
  SCHEDULES_TITLE,
  TASK_HINT,
  TASK_LABEL,
  TASK_PLACEHOLDER,
  WHEN_LABEL,
} from '../logic/scheduleCopy';
import { useScheduleAgents } from '../useScheduleAgents';
import AgentPicker from './AgentPicker';
import { ChoiceChips } from './Chip';
import Field from './Field';
import { useScheduleActions } from './useScheduleActions';
import WhenFields from './WhenFields';

type Props = {
  /** The one to change; null for a new one. */
  schedule: Schedule | null;
  /** The page is for this agent: a new one is for it. */
  agentId: AgentId | null;
  onDone: () => void;
};

const CHAT_OPTIONS = (['new', 'same'] as const).map((value) => ({ value, label: chatLabel(value) }));

// A schedule's form, in the Schedules page: which agent (a new one only;
// the agents whose kind can run schedules, as the drawer shows them), the task, when, and which
// chat; then Save, and for one already there Run now and Delete. Problems
// show under their fields once you have tried to save. The form scrolls
// so the field you type in stays above the keyboard.
export default function ScheduleEditor({ schedule, agentId, onDone }: Props) {
  const runners = useScheduleAgents();
  const agents = useAgentsStore((s) => s.agents);
  const [draft, setDraft] = useState<Draft>(() => {
    const now = Date.now();
    if (schedule) return draftOf(schedule, now);
    const only = runners.length === 1 ? runners[0].id : null;
    return newDraft(agentId && runners.some((a) => a.id === agentId) ? agentId : only, now);
  });
  const [tried, setTried] = useState(false);
  const [doomed, setDoomed] = useState(false);
  const actions = useScheduleActions(schedule, onDone);

  const now = Date.now();
  const problems = tried ? draftProblems(draft, now) : [];
  const of = (field: FieldName) => problems.filter((p) => p.field === field).map((p) => p.text);
  const dirty = useMemo(() => {
    if (!schedule) return false;
    const patch = patchOf(schedule, draft, Date.now());
    return patch == null || Object.keys(patch).length > 0;
  }, [schedule, draft]);
  const agentName = agents.find((a) => a.id === (schedule?.agentId ?? draft.agentId))?.name ?? schedule?.agentId ?? '';

  const save = async () => {
    setTried(true);
    await actions.save(draft);
  };

  return (
    <FormScreen>
      <PageHeader kicker={schedule ? agentName : SCHEDULES_TITLE} title={editorTitle(schedule != null)} />
      {schedule?.by === 'agent' ? <Note>{AGENT_SET_NOTE}</Note> : null}
      {schedule && !schedule.on ? <Note>{OFF_NOTE}</Note> : null}

      {schedule ? null : (
        <Field label={AGENT_LABEL} problems={of('agent')}>
          {runners.length > 0 ? (
            <AgentPicker agents={runners} value={draft.agentId} onPick={(id) => setDraft({ ...draft, agentId: id })} />
          ) : (
            <Note>{NO_AGENTS}</Note>
          )}
        </Field>
      )}

      <Field label={TASK_LABEL} hint={TASK_HINT} problems={of('text')}>
        <AppInput
          value={draft.text}
          onChangeText={(text) => setDraft({ ...draft, text })}
          placeholder={TASK_PLACEHOLDER}
          multiline
          minHeight={120}
          textAlignVertical="top"
          paddingVertical="3"
          autoCapitalize="sentences"
          accessibilityLabel={TASK_LABEL}
        />
      </Field>

      <Field label={WHEN_LABEL}>
        <WhenFields draft={draft} onChange={setDraft} now={now} problems={[...of('time'), ...of('every')]} />
      </Field>

      <Field label={CHAT_LABEL} hint={chatNote(draft.chat)}>
        <ChoiceChips<ChatMode> options={CHAT_OPTIONS} value={draft.chat} onPick={(chat) => setDraft(withChat(draft, chat))} />
      </Field>

      {actions.note ? <Note tone={actions.note.error ? 'error' : 'muted'}>{actions.note.text}</Note> : null}
      <AppButton onPress={save} loading={actions.busy === 'save'} disabled={!schedule && runners.length === 0}>
        {saveLabel(schedule != null)}
      </AppButton>
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
