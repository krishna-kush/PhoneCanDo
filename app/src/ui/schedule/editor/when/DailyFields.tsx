import { XStack, YStack } from 'tamagui';
import PlainText from '../../../common/PlainText';
import Note from '../../../env/parts/Note';
import { parseClock } from '../../logic/clock';
import { type Draft, toggleDay } from '../../logic/draft';
import { DAYS_HINT } from '../../logic/editorCopy';
import { DAYS_PRESETS, isDays } from '../../logic/presets';
import { daysText } from '../../logic/timingText';
import { Chip } from '../Chip';
import TimeTiles from './TimeTiles';
import WeekStrip from './WeekStrip';

type Props = { draft: Draft; onChange: (d: Draft) => void; dialogs: boolean };

// Daily: the time on split-flap tiles with the timing in words beside it
// ("weekdays at 09:00"), the week's days on a calendar strip, and quick
// sets of days under it.
export default function DailyFields({ draft, onChange, dialogs }: Props) {
  const time = parseClock(draft.time);
  return (
    <YStack gap="3">
      <XStack alignItems="center" gap="3">
        <TimeTiles draft={draft} onChange={onChange} dialogs={dialogs} />
        {time ? (
          <PlainText flex={1} fontFamily="mono" fontSize={12} color="secondaryInk" numberOfLines={2}>
            {`${daysText(draft.days)} at ${time}`}
          </PlainText>
        ) : null}
      </XStack>
      <WeekStrip days={draft.days} onToggle={(day) => onChange(toggleDay(draft, day))} />
      <XStack flexWrap="wrap" gap="2">
        {DAYS_PRESETS.map((p) => (
          <Chip key={p.label} label={p.label} on={isDays(draft, p)} onPress={() => onChange({ ...draft, days: [...p.days] })} />
        ))}
      </XStack>
      {draft.days.length === 0 ? <Note>{DAYS_HINT}</Note> : null}
    </YStack>
  );
}
