import { useMemo, useState } from 'react';
import { Text, XStack, YStack } from 'tamagui';
import { contextCheck } from '../../../engine/models/native';
import type { LocalModel, RamCheck } from '../../../engine/models/types';
import { useAgentsStore } from '../../../state/agents';
import { chooseModelContext } from '../../../state/flows/modelContext';
import AppButton from '../../common/AppButton';
import { useTheme } from '../../common/globals';
import { startFailureCode, startFailureText } from '../../env/logic/errorText';
import Note from '../../env/parts/Note';
import ProgressBar from '../../env/parts/ProgressBar';
import {
  automaticNote,
  chooseNote,
  contextAt,
  contextText,
  restartNote,
  runningOn,
  SPEED_NOTE,
  stopOf,
} from '../logic/context';
import { modelErrorText } from '../logic/errorText';
import ChoiceRow from '../parts/ChoiceRow';
import VerdictLine from '../parts/VerdictLine';
import ContextSlider from './ContextSlider';

type Props = {
  model: LocalModel;
  /** Saved, or cancelled: close the setting. */
  onDone: () => void;
};

// A model's Context setting, open under its card: Automatic (what the phone
// can spare when the model starts) or a context of your own on a slider,
// whose RAM verdict follows it live. A choice may pass what the phone can
// spare (Android may stop the model server), not its RAM. Saving restarts
// the agents running on the model, which then start it with the new context.
export default function ContextSetting({ model, onDone }: Props) {
  const t = useTheme();
  const range = model.contextRange;
  const [automatic, setAutomatic] = useState(model.contextChoice == null);
  const [stop, setStop] = useState(() => stopOf(range, model.contextChoice ?? model.autoContext));
  const [busy, setBusy] = useState(false);
  /** The agents a running save restarts, named when it began. */
  const [restarting, setRestarting] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const agents = useAgentsStore((s) => s.agents);
  const statuses = useAgentsStore((s) => s.statuses);

  const context = contextAt(range, stop);
  const ram = useMemo<RamCheck | null>(() => {
    if (automatic) return null;
    try {
      return contextCheck(model.id, context);
    } catch {
      return null;
    }
  }, [automatic, model.id, context]);
  const running = runningOn(model.id, agents, statuses);
  const choice = automatic ? null : context;
  const changed = choice !== model.contextChoice;
  const refused = ram?.verdict === 'too_big';

  const save = async () => {
    setBusy(true);
    setRestarting(running);
    setError(null);
    const res = await chooseModelContext(model.id, choice);
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
    <YStack gap="$2" borderTopWidth={1} borderColor={t.line} paddingTop="$3">
      <Text fontSize={14} fontWeight="600">
        Context
      </Text>
      <YStack gap="$2" accessibilityRole="radiogroup">
        <ChoiceRow
          label="Automatic"
          note={automaticNote(model)}
          selected={automatic}
          disabled={busy}
          onPress={() => setAutomatic(true)}
        />
        <ChoiceRow
          label="Choose"
          note={chooseNote(range)}
          selected={!automatic}
          disabled={busy}
          onPress={() => setAutomatic(false)}
        />
      </YStack>
      <Note>{SPEED_NOTE}</Note>
      {!automatic ? (
        <>
          <XStack alignItems="center" gap="$3">
            <ContextSlider range={range} stop={stop} disabled={busy} onStop={setStop} />
            <Text fontFamily="$mono" fontSize={14} minWidth={48} textAlign="right">
              {contextText(context)}
            </Text>
          </XStack>
          {ram ? <VerdictLine ram={ram} /> : null}
        </>
      ) : null}
      {restarting.length > 0 ? (
        <ProgressBar label="Restarting with the new context: loading the model can take a minute" fraction={null} />
      ) : !busy && running.length > 0 ? (
        <Note>{restartNote(running)}</Note>
      ) : null}
      {error ? <Note tone="error">{error}</Note> : null}
      <XStack gap="$2">
        <AppButton flex={1} loading={busy} disabled={!changed || refused} onPress={() => void save()}>
          Save
        </AppButton>
        <AppButton flex={1} variant="secondary" disabled={busy} onPress={onDone}>
          {error ? 'Close' : 'Cancel'}
        </AppButton>
      </XStack>
    </YStack>
  );
}
