import { useState } from 'react';
import { Pressable } from 'react-native';
import { YStack } from 'tamagui';
import { updateSchedule } from '../../engine/schedule/native';
import type { Schedule } from '../../engine/schedule/types';
import { useScheduleStore } from '../../state/schedule';
import { HIT, useTheme } from '../common/globals';
import PlainText from '../common/PlainText';
import { reasonText } from './logic/scheduleCopy';

type Props = {
  schedule: Schedule;
  /** Why the switch didn't take, or null once it did. */
  onError: (text: string | null) => void;
};

// A schedule's on/off: the switch rows' square mark, filled when on, saved
// natively; the list re-reads on the runner's event.
export default function OnOffToggle({ schedule: s, onError }: Props) {
  const t = useTheme();
  const [busy, setBusy] = useState(false);

  const toggle = async () => {
    if (busy) return;
    setBusy(true);
    const r = await updateSchedule(s.id, { on: !s.on });
    setBusy(false);
    onError(r.ok ? null : reasonText(r.reason));
    useScheduleStore.getState().refreshSchedules();
  };

  return (
    <Pressable
      onPress={toggle}
      android_ripple={{ color: t.line, borderless: true }}
      accessibilityRole="switch"
      accessibilityState={{ checked: s.on, busy }}
      accessibilityLabel={s.on ? 'On' : 'Off'}
      accessibilityHint={s.on ? 'Switches it off' : 'Switches it on'}
    >
      <YStack width={HIT.minTouch} minHeight={HIT.minTouch} flex={1} alignItems="center" justifyContent="center">
        <PlainText fontFamily="mono" fontSize={14} width={14} textAlign="center" color={s.on ? 'primary' : 'faint'}>
          {s.on ? '■' : '□'}
        </PlainText>
      </YStack>
    </Pressable>
  );
}
