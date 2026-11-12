import { useEffect, useState } from 'react';
import { Pressable } from 'react-native';
import { XStack, YStack } from 'tamagui';
import { canKeepRunning, keepRunning, keepRunningAsk, setKeepRunning } from '../../../engine/keepRunning';
import { HIT, useTheme } from '../../common/globals';
import PlainText from '../../common/PlainText';
import { KEEP_RUNNING_TITLE, keepAskNote, keepRunningNote } from './agentSettings';

// The runner's work watch looks this often; the ask's line follows it.
const ASK_READ_MS = 30_000;

// The agent's "Keep running" in its Settings block, laid out as the switch
// rows beside it ("Other agents can wake it"): the title and a square mark
// for on and off, and a line under it saying what that means now. Off, the
// runner stops the agent once it is idle in the background and nothing it
// started still runs; on, only to free memory. While the agent has asked
// to stay up itself (agents_keep_running), a second line says why and
// until when. A build that cannot keep it shows no row.
export default function KeepRunningRow({ agentId }: { agentId: string }) {
  const t = useTheme();
  const [on, setOn] = useState(() => keepRunning(agentId));
  const [failed, setFailed] = useState(false);
  const [ask, setAsk] = useState(() => keepRunningAsk(agentId));
  useEffect(() => {
    setAsk(keepRunningAsk(agentId));
    const timer = setInterval(() => setAsk(keepRunningAsk(agentId)), ASK_READ_MS);
    return () => clearInterval(timer);
  }, [agentId]);
  if (!canKeepRunning()) return null;
  const toggle = () => {
    const kept = setKeepRunning(agentId, !on);
    setFailed(kept == null);
    if (kept != null) setOn(kept);
  };
  return (
    <Pressable
      onPress={toggle}
      android_ripple={{ color: t.line }}
      accessibilityRole="switch"
      accessibilityState={{ checked: on }}
      accessibilityLabel={KEEP_RUNNING_TITLE}
      accessibilityHint={keepRunningNote(on)}
    >
      <YStack minHeight={HIT.buttonH} justifyContent="center" paddingHorizontal="2" paddingVertical="2" gap={2}>
        <XStack alignItems="center" gap="3">
          <PlainText fontSize={16} fontWeight="500" numberOfLines={1} flexShrink={1}>
            {KEEP_RUNNING_TITLE}
          </PlainText>
          <XStack flex={1} />
          <PlainText fontFamily="mono" fontSize={14} width={14} textAlign="center" color={on ? 'primary' : 'faint'}>
            {on ? '■' : '□'}
          </PlainText>
        </XStack>
        <PlainText fontSize={13} color={failed ? 'primary' : 'muted'}>
          {failed ? "Couldn't save it." : keepRunningNote(on)}
        </PlainText>
        {ask ? (
          <PlainText fontSize={13} color="muted">
            {keepAskNote(ask)}
          </PlainText>
        ) : null}
      </YStack>
    </Pressable>
  );
}
