import { useState } from 'react';
import { Pressable } from 'react-native';
import { XStack, YStack } from 'tamagui';
import type { Schedule } from '../../engine/schedule/types';
import { useTheme } from '../common/globals';
import PlainText from '../common/PlainText';
import AgentLine from './AgentLine';
import type { TimelineEntry } from './logic/timeline';
import { byText, lastRunText, outcomeTone, setByLine } from './logic/scheduleCopy';
import { timeColumn, timingText } from './logic/timingText';
import OnOffToggle from './OnOffToggle';

type Props = {
  entry: TimelineEntry;
  now: number;
  onEdit: (s: Schedule) => void;
};

// One schedule, time first (the other layout, while you choose): its next
// run's clock time in a column on the left with how far off it is, then
// the task, the agent (face, name, serial, kind, state), the timing, who
// set it and its chat, and its last run. A tap opens the editor; the
// square switches it on or off.
export default function ScheduleRowTimeFirst({ entry, now, onEdit }: Props) {
  const t = useTheme();
  const [error, setError] = useState<string | null>(null);
  const s = entry.schedule;
  const col = timeColumn(s, now);

  return (
    <XStack alignItems="stretch">
      <Pressable
        onPress={() => onEdit(s)}
        android_ripple={{ color: t.line }}
        style={{ flex: 1 }}
        accessibilityRole="button"
        accessibilityLabel={`${col.time} ${col.under}. ${s.text}. ${entry.agent?.name ?? ''}. ${byText(s.by)}`}
        accessibilityHint="Opens it to change or delete"
      >
        <XStack paddingHorizontal="3" paddingVertical="3" gap="3" opacity={s.on ? 1 : 0.6}>
          <YStack width={64} gap={2}>
            <PlainText fontFamily="mono" fontSize={18} fontWeight="700" color={s.on ? 'fg' : 'dim'} numberOfLines={1}>
              {col.time}
            </PlainText>
            {col.under ? (
              <PlainText fontFamily="mono" fontSize={11} color={col.under === 'due' ? 'primary' : 'secondaryInk'} numberOfLines={1}>
                {col.under}
              </PlainText>
            ) : null}
          </YStack>
          <YStack flex={1} minWidth={0} gap="2">
            <PlainText fontSize={15} lineHeight="21px" numberOfLines={2} ellipsizeMode="tail">
              {s.text}
            </PlainText>
            <AgentLine agentId={s.agentId} agent={entry.agent} size={18} />
            <YStack gap={2}>
              <PlainText fontFamily="mono" fontSize={11} color="dim" numberOfLines={1}>
                {`${timingText(s.timing, now)} · ${setByLine(s)}`}
              </PlainText>
              {s.lastRun ? (
                <PlainText fontFamily="mono" fontSize={11} color={outcomeTone(s.lastRun.outcome)} numberOfLines={2}>
                  {lastRunText(s.lastRun, now)}
                </PlainText>
              ) : null}
            </YStack>
            {error ? (
              <PlainText fontSize={13} color="primary">
                {error}
              </PlainText>
            ) : null}
          </YStack>
        </XStack>
      </Pressable>
      <OnOffToggle schedule={s} onError={setError} />
    </XStack>
  );
}
