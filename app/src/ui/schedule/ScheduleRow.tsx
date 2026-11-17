import { useState } from 'react';
import { Pressable } from 'react-native';
import { XStack, YStack } from 'tamagui';
import type { Schedule } from '../../engine/schedule/types';
import { useTheme } from '../common/globals';
import PlainText from '../common/PlainText';
import { ROW_GUTTER } from '../common/rows/place';
import AgentLine from './AgentLine';
import type { TimelineEntry } from './logic/timeline';
import { byText, lastRunText, outcomeTone, setByLine } from './logic/scheduleCopy';
import { isDone, nextRunText, timingText } from './logic/timingText';
import DoneMark from './DoneMark';
import OnOffToggle from './OnOffToggle';

type Props = {
  entry: TimelineEntry;
  now: number;
  onEdit: (s: Schedule) => void;
};

// One schedule, agent first: the agent as the drawer shows it (face, name,
// serial, kind, state), then the task (two lines at most), when it runs
// next, who set it and its chat, and what its last run did. A tap opens
// the editor; the square on the right switches it on or off, or for a
// one-off that ran is a done mark (a new time in the editor brings it back).
export default function ScheduleRow({ entry, now, onEdit }: Props) {
  const t = useTheme();
  const [error, setError] = useState<string | null>(null);
  const s = entry.schedule;
  const when = `${nextRunText(s, now)} · ${timingText(s.timing, now)}`;
  const done = isDone(s);

  return (
    <XStack alignItems="stretch">
      <Pressable
        onPress={() => onEdit(s)}
        android_ripple={{ color: t.secondarySoft }}
        style={{ flex: 1 }}
        accessibilityRole="button"
        accessibilityLabel={`${entry.agent?.name ?? ''}. ${s.text}. ${when}. ${byText(s.by)}`}
        accessibilityHint="Opens it to change or delete"
      >
        <YStack paddingHorizontal={ROW_GUTTER} paddingVertical="3" gap="2" opacity={s.on && !done ? 1 : 0.6}>
          <AgentLine agentId={s.agentId} agent={entry.agent} />
          <PlainText fontSize={15} lineHeight="21px" numberOfLines={2} ellipsizeMode="tail">
            {s.text}
          </PlainText>
          <YStack gap={2}>
            <PlainText fontFamily="mono" fontSize={12} color={s.on && !done ? 'secondaryInk' : 'dim'} numberOfLines={2}>
              {when}
            </PlainText>
            <PlainText fontFamily="mono" fontSize={11} color="dim" numberOfLines={1}>
              {setByLine(s)}
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
      </Pressable>
      {done ? <DoneMark /> : <OnOffToggle schedule={s} onError={setError} />}
    </XStack>
  );
}
