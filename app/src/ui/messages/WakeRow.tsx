import { useState } from 'react';
import { Pressable } from 'react-native';
import { XStack, YStack } from 'tamagui';
import type { Agent } from '../../engine/agents/records';
import { isWakeable, setAgentWakeable } from '../../engine/messages/native';
import { useAgentsStore } from '../../state/agents';
import { HIT, useTheme } from '../common/globals';
import PlainText from '../common/PlainText';
import { WAKE_TITLE, wakeSubtitle } from './logic/messagesCopy';

// "Other agents can wake it" in the agent's Settings block, laid out as
// the rows around it with the square mark Keep running uses, and a line
// under it saying what it does. On (the default), another agent's message
// that asks to wake it can start a turn while it is idle; it never starts
// a stopped agent. Kept natively; the record re-read shows it.
export default function WakeRow({ agent }: { agent: Agent }) {
  const t = useTheme();
  const refreshAgents = useAgentsStore((s) => s.refreshAgents);
  const [error, setError] = useState<string | null>(null);
  const on = isWakeable(agent);
  const toggle = () => {
    try {
      setAgentWakeable(agent.id, !on);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    refreshAgents();
  };
  return (
    <Pressable
      onPress={toggle}
      android_ripple={{ color: t.line }}
      accessibilityRole="switch"
      accessibilityState={{ checked: on }}
      accessibilityLabel={WAKE_TITLE}
      accessibilityHint={wakeSubtitle(on)}
    >
      <YStack minHeight={HIT.buttonH} justifyContent="center" paddingHorizontal="2" paddingVertical="2" gap={2}>
        <XStack alignItems="center" gap="3">
          <PlainText fontSize={16} fontWeight="500" numberOfLines={1} flexShrink={1}>
            {WAKE_TITLE}
          </PlainText>
          <XStack flex={1} />
          <PlainText fontFamily="mono" fontSize={14} width={14} textAlign="center" color={on ? 'primary' : 'faint'}>
            {on ? '■' : '□'}
          </PlainText>
        </XStack>
        <PlainText fontSize={13} color={error ? 'primary' : 'muted'}>
          {error ? `Couldn't save it: ${error}` : wakeSubtitle(on)}
        </PlainText>
      </YStack>
    </Pressable>
  );
}
