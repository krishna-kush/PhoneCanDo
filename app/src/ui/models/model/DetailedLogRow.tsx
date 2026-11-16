import { useState } from 'react';
import { Pressable } from 'react-native';
import { XStack, YStack } from 'tamagui';
import type { LocalModel } from '../../../engine/models/types';
import { useAgentsStore } from '../../../state/agents';
import { chooseDetailedLog } from '../../../state/flows/modelMemory';
import { HIT, useTheme } from '../../common/globals';
import PlainText from '../../common/PlainText';
import { startFailureCode, startFailureText } from '../../env/logic/errorText';
import Note from '../../env/parts/Note';
import ProgressBar from '../../env/parts/ProgressBar';
import { restartNote, runningOn } from '../logic/context';
import { modelErrorText } from '../logic/errorText';
import { DETAILED_LOG_TITLE, detailedLogNote } from '../logic/detailedLog';

// A model's "Detailed log" on its Server log page, laid out as the switch
// rows elsewhere (the title and a square mark for on and off, what it
// means under it). Off by default. A change is saved on the model and
// restarts the agents running on it, so its server starts again logging
// in detail, or not: a line names them before, and a bar shows while it
// restarts.
export default function DetailedLogRow({ model }: { model: LocalModel }) {
  const t = useTheme();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const agents = useAgentsStore((s) => s.agents);
  const statuses = useAgentsStore((s) => s.statuses);
  const running = runningOn(model.id, agents, statuses);
  const on = model.detailedLog;
  const toggle = async () => {
    setBusy(true);
    setError(null);
    const res = await chooseDetailedLog(model.id, !on);
    setBusy(false);
    if (!res.ok) {
      setError(modelErrorText(res.code, res.message));
      return;
    }
    const failed = res.restarts.flatMap(({ result }) => {
      const code = startFailureCode(result.status);
      return code ? [startFailureText(code, result.error)] : [];
    });
    if (failed.length > 0) setError(failed.join(' '));
  };
  return (
    <YStack gap="2">
      <Pressable
        onPress={busy ? undefined : () => void toggle()}
        android_ripple={{ color: t.line }}
        accessibilityRole="switch"
        accessibilityState={{ checked: on, disabled: busy }}
        accessibilityLabel={DETAILED_LOG_TITLE}
        accessibilityHint={detailedLogNote(on)}
      >
        <YStack minHeight={HIT.buttonH} justifyContent="center" paddingHorizontal="2" paddingVertical="2" gap={2} opacity={busy ? 0.5 : 1}>
          <XStack alignItems="center" gap="3">
            <PlainText fontSize={16} fontWeight="500" numberOfLines={1} flexShrink={1}>
              {DETAILED_LOG_TITLE}
            </PlainText>
            <XStack flex={1} />
            <PlainText fontFamily="mono" fontSize={14} width={14} textAlign="center" color={on ? 'primary' : 'faint'}>
              {on ? '■' : '□'}
            </PlainText>
          </XStack>
          <PlainText fontSize={13} color="muted">
            {detailedLogNote(on)}
          </PlainText>
        </YStack>
      </Pressable>
      {busy ? (
        <ProgressBar label="Restarting the model: loading it can take a minute" fraction={null} />
      ) : running.length > 0 ? (
        <Note>{restartNote(running, 'Changing it')}</Note>
      ) : null}
      {error ? <Note tone="error">{error}</Note> : null}
    </YStack>
  );
}
