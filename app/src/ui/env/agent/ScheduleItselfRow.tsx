import { useState } from 'react';
import { Pressable } from 'react-native';
import { XStack, YStack } from 'tamagui';
import { canScheduleItself, setCanScheduleItself } from '../../../engine/schedule/native';
import { HIT, useTheme } from '../../common/globals';
import PlainText from '../../common/PlainText';
import { SCHEDULE_ITSELF_TITLE, scheduleItselfNote } from '../../schedule/logic/scheduleCopy';

// The agent's "Can schedule itself" in its Settings block, laid out as
// Keep running: on (the default), the agent may set reminders for itself
// with its schedule tools; off, the runner refuses them. Kept natively,
// so it holds with no JS around.
export default function ScheduleItselfRow({ agentId }: { agentId: string }) {
  const t = useTheme();
  const [on, setOn] = useState(() => canScheduleItself(agentId));
  const [failed, setFailed] = useState(false);
  const toggle = () => {
    const kept = setCanScheduleItself(agentId, !on);
    setFailed(kept == null);
    if (kept != null) setOn(kept);
  };
  return (
    <Pressable
      onPress={toggle}
      android_ripple={{ color: t.line }}
      accessibilityRole="switch"
      accessibilityState={{ checked: on }}
      accessibilityLabel={SCHEDULE_ITSELF_TITLE}
      accessibilityHint={scheduleItselfNote(on)}
    >
      <YStack minHeight={HIT.buttonH} justifyContent="center" paddingHorizontal="2" paddingVertical="2" gap={2}>
        <XStack alignItems="center" gap="3">
          <PlainText fontSize={16} fontWeight="500" numberOfLines={1} flexShrink={1}>
            {SCHEDULE_ITSELF_TITLE}
          </PlainText>
          <XStack flex={1} />
          <PlainText fontFamily="mono" fontSize={14} width={14} textAlign="center" color={on ? 'primary' : 'faint'}>
            {on ? '■' : '□'}
          </PlainText>
        </XStack>
        <PlainText fontSize={13} color={failed ? 'primary' : 'muted'}>
          {failed ? "Couldn't save it." : scheduleItselfNote(on)}
        </PlainText>
      </YStack>
    </Pressable>
  );
}
