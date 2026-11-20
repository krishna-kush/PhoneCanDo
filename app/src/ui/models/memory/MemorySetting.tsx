import { useMemo, useState } from 'react';
import { YStack } from 'tamagui';
import { memoryCheck } from '../../../engine/models/native';
import type { KvCacheChoice, LocalModel, MemoryChoices, MemoryPlan, RamShare } from '../../../engine/models/types';
import { useAgentsStore } from '../../../state/agents';
import { chooseModelMemory } from '../../../state/flows/modelMemory';
import ActionDeck from '../../common/actions/ActionDeck';
import PlainText from '../../common/PlainText';
import RowGroup from '../../common/rows/RowGroup';
import { startFailureCode, startFailureText } from '../../env/logic/errorText';
import Note from '../../env/parts/Note';
import ProgressBar from '../../env/parts/ProgressBar';
import ContextSetting from '../context/ContextSetting';
import { canChoose, contextAt, restartNote, runningOn, stopOf } from '../logic/context';
import { modelErrorText } from '../logic/errorText';
import {
  advancedCount,
  advancedCountText,
  ESTIMATE_LINE,
  freeLimitLine,
  savedChatsLine,
  MEMORY_NOTE,
  MEMORY_TITLE,
  memoryChanged,
  NOTE_SIZE_NOTE,
  NOTE_SIZE_TITLE,
  noteSizeOptions,
  planLine,
  refused,
  SAVED_TITLE,
  SHARE_TITLE,
  shareOptions,
  SNAPSHOTS_TITLE,
  THREADS_TITLE,
} from '../logic/memory';
import ChoiceRow from '../parts/ChoiceRow';
import VerdictLine from '../parts/VerdictLine';
import AdvancedFold from './AdvancedFold';
import CountPicker from './CountPicker';

type Props = {
  model: LocalModel;
  /** Saved, or cancelled: close the setting. */
  onDone: () => void;
};

// A model's Memory setting, open under its card: how much of the phone's
// RAM it may use (Less, Normal, More), with our planner's line for this
// model on this phone under it, live as the choices change (with chats
// kept on storage it says so in place of the saved chats in RAM, and until
// the model's server has measured itself here, that the line is an
// estimate); then, folded,
// Advanced: its Context, note size (KV cache), saved chats, snapshots
// (context checkpoints, only for a model that has them) and CPU threads,
// each Auto by default. Save is off while the planner says the model would
// not run. Saving restarts the agents running on the model, which then
// start it with the new plan.
export default function MemorySetting({ model, onDone }: Props) {
  const range = model.contextRange;
  const [share, setShare] = useState<RamShare>(model.memory.ramShare);
  const [kvCache, setKvCache] = useState<KvCacheChoice>(model.memory.kvCache);
  const [saved, setSaved] = useState(model.memory.savedPrompts);
  const [snapshots, setSnapshots] = useState(model.memory.checkpoints);
  const [threads, setThreads] = useState(model.memory.threads);
  const [automatic, setAutomatic] = useState(model.contextChoice == null);
  const [stop, setStop] = useState(() => stopOf(range, model.contextChoice ?? model.autoContext));
  const [open, setOpen] = useState(() => advancedCount(model.memory, model.contextChoice) > 0);
  const [busy, setBusy] = useState(false);
  /** The agents a running save restarts, named when it began. */
  const [restarting, setRestarting] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const agents = useAgentsStore((s) => s.agents);
  const statuses = useAgentsStore((s) => s.statuses);

  const memory: MemoryChoices = { ramShare: share, kvCache, savedPrompts: saved, checkpoints: snapshots, threads };
  const context = automatic ? null : contextAt(range, stop);
  const plan = useMemo<MemoryPlan | null>(() => {
    try {
      return memoryCheck(model.id, context, { ramShare: share, kvCache, savedPrompts: saved, checkpoints: snapshots, threads });
    } catch {
      return null;
    }
  }, [model.id, context, share, kvCache, saved, snapshots, threads]);
  const running = runningOn(model.id, agents, statuses);
  const changed = memoryChanged({ context: model.contextChoice, memory: model.memory }, { context, memory });
  const showContext = canChoose(range) || model.contextChoice != null;

  const save = async () => {
    setBusy(true);
    setRestarting(running);
    setError(null);
    const res = await chooseModelMemory(model.id, context, memory);
    setBusy(false);
    setRestarting([]);
    if (!res.ok) {
      setError(modelErrorText(res.code, res.message));
      return;
    }
    const failed = res.restarts.flatMap(({ result }) => {
      const code = startFailureCode(result.status);
      return code ? [startFailureText(code, result.error)] : [];
    });
    if (failed.length > 0) setError(failed.join(' '));
    else onDone();
  };

  return (
    <YStack gap="2" borderTopWidth={1} borderColor="line" paddingTop="3">
      <PlainText fontSize={14} fontWeight="600">
        {MEMORY_TITLE}
      </PlainText>
      <Note>{MEMORY_NOTE}</Note>
      <RowGroup title={SHARE_TITLE} barcode="modelRam" radio>
        {shareOptions(model.traits.budgets).map((o) => (
          <ChoiceRow key={o.value} label={o.label} note={o.note} selected={share === o.value} disabled={busy} onPress={() => setShare(o.value)} />
        ))}
      </RowGroup>
      {plan ? (
        <YStack gap="1" accessibilityLiveRegion="polite">
          <PlainText fontFamily="mono" fontSize={13} color="secondaryInk">
            {planLine(plan)}
          </PlainText>
          {savedChatsLine(plan, saved ?? model.traits.savedPrompts.auto) ? (
            <PlainText fontSize={13} color="muted">
              {savedChatsLine(plan, saved ?? model.traits.savedPrompts.auto)}
            </PlainText>
          ) : null}
          {freeLimitLine(plan) ? (
            <PlainText fontSize={13} color="muted">
              {freeLimitLine(plan)}
            </PlainText>
          ) : null}
          {!plan.measured ? (
            <PlainText fontSize={13} color="muted">
              {ESTIMATE_LINE}
            </PlainText>
          ) : null}
        </YStack>
      ) : null}
      {plan && plan.ram.verdict !== 'fits' ? <VerdictLine ram={plan.ram} /> : null}
      <AdvancedFold open={open} onOpen={setOpen} count={advancedCountText(advancedCount(memory, context))}>
        {showContext ? (
          <ContextSetting model={model} automatic={automatic} stop={stop} disabled={busy} onAutomatic={setAutomatic} onStop={setStop} />
        ) : null}
        <RowGroup title={NOTE_SIZE_TITLE} barcode="noteSize" radio>
          {noteSizeOptions(model.traits, kvCache === 'auto' ? (plan?.halfKvCache ?? null) : null).map((o) => (
            <ChoiceRow key={o.value} label={o.label} note={o.note} selected={kvCache === o.value} disabled={busy} onPress={() => setKvCache(o.value)} />
          ))}
        </RowGroup>
        <Note>{NOTE_SIZE_NOTE}</Note>
        <CountPicker
          title={SAVED_TITLE}
          kind="saved"
          count={model.traits.savedPrompts}
          value={saved}
          fitsNow={plan?.savedPrompts ?? null}
          onStorage={(plan?.storedChats ?? 0) > 0}
          disabled={busy}
          onPick={setSaved}
        />
        {model.traits.checkpoints ? (
          <CountPicker
            title={SNAPSHOTS_TITLE}
            kind="snapshots"
            count={model.traits.checkpoints}
            value={snapshots}
            disabled={busy}
            onPick={setSnapshots}
          />
        ) : null}
        <CountPicker title={THREADS_TITLE} kind="threads" count={model.traits.threads} value={threads} disabled={busy} onPick={setThreads} />
      </AdvancedFold>
      {restarting.length > 0 ? (
        <ProgressBar label="Restarting with the new memory: loading the model can take a minute" fraction={null} />
      ) : !busy && running.length > 0 ? (
        <Note>{restartNote(running)}</Note>
      ) : null}
      {error ? <Note tone="error">{error}</Note> : null}
      <ActionDeck
        barcode="deckModelMemory"
        actions={[
          { label: 'Save', role: 'go', mark: 'save', loading: busy, disabled: !changed || refused(plan), onPress: () => void save() },
          { label: error ? 'Close' : 'Cancel', role: 'back', disabled: busy, onPress: onDone },
        ]}
      />
    </YStack>
  );
}
