import { XStack, YStack } from 'tamagui';
import { pickAvailable, pickDate, pickTime } from '../../../engine/pick';
import { WEEKDAYS } from '../../../engine/schedule/parse';
import AppInput from '../../common/AppInput';
import Note from '../../env/parts/Note';
import { addDays, dayLabel, dayName, parseClock, startOfDay } from '../logic/clock';
import { type Draft, type EveryUnit, toggleDay, type WhenKind, withWhen } from '../logic/draft';
import { ONCE_MAX_AHEAD_DAYS } from '../logic/limits';
import { DAYS_PRESETS, EVERY_PRESETS, isDays, isEvery, isOnceAt, oncePresets, withOnceAt } from '../logic/presets';
import { DAYS_HINT, EVERY_HINT, TIME_PLACEHOLDER, UNIT_WORDS, WHEN_WORDS } from '../logic/scheduleCopy';
import { Chip, ChoiceChips } from './Chip';
import PickBox from './PickBox';

type Props = {
  draft: Draft;
  onChange: (d: Draft) => void;
  now: number;
  /** What is wrong with the time or the interval (shown under it). */
  problems: readonly string[];
};

const WHEN_OPTIONS = (['once', 'every', 'daily'] as const).map((value) => ({ value, label: WHEN_WORDS[value] }));
const UNIT_OPTIONS = (['min', 'hours'] as const).map((value) => ({ value, label: UNIT_WORDS[value] }));

// When it runs, mostly by tapping: once (a quick time, or a day and a time
// picked in Android's own dialogs), every so often (a quick interval, or
// any number of minutes or hours), or daily at a time on the days picked
// (none: every day). A build without the dialogs types the time instead
// (the 24-hour clock; "930" reads 09:30 once you leave the field).
export default function WhenFields({ draft, onChange, now, problems }: Props) {
  const dialogs = pickAvailable();
  return (
    <YStack gap="3">
      <ChoiceChips<WhenKind> options={WHEN_OPTIONS} value={draft.when} onPick={(w) => onChange(withWhen(draft, w))} />
      {draft.when === 'once' ? (
        <YStack gap="2">
          <XStack flexWrap="wrap" gap="2">
            {oncePresets(now).map((p) => (
              <Chip key={p.label} label={p.label} on={isOnceAt(draft, p.at)} onPress={() => onChange(withOnceAt(draft, p.at))} />
            ))}
          </XStack>
          <XStack alignItems="center" gap="2" flexWrap="wrap">
            {dialogs ? (
              <PickBox
                value={dayLabel(draft.day, now)}
                accessibilityLabel="Day"
                onPress={async () => {
                  const day = await pickDate(draft.day, startOfDay(now), addDays(now, ONCE_MAX_AHEAD_DAYS));
                  if (day != null) onChange({ ...draft, day });
                }}
              />
            ) : null}
            <TimeField draft={draft} onChange={onChange} dialogs={dialogs} />
          </XStack>
        </YStack>
      ) : null}
      {draft.when === 'every' ? (
        <YStack gap="2">
          <XStack flexWrap="wrap" gap="2">
            {EVERY_PRESETS.map((p) => (
              <Chip key={p.label} label={p.label} on={isEvery(draft, p)} onPress={() => onChange({ ...draft, every: p.every, unit: p.unit })} />
            ))}
          </XStack>
          <XStack alignItems="center" gap="2" flexWrap="wrap">
            <AppInput
              value={draft.every}
              onChangeText={(every) => onChange({ ...draft, every })}
              keyboardType="number-pad"
              width={96}
              fontFamily="mono"
              accessibilityLabel="Every how many"
            />
            <ChoiceChips<EveryUnit> options={UNIT_OPTIONS} value={draft.unit} onPick={(unit) => onChange({ ...draft, unit })} />
          </XStack>
          <Note>{EVERY_HINT}</Note>
        </YStack>
      ) : null}
      {draft.when === 'daily' ? (
        <YStack gap="2">
          <TimeField draft={draft} onChange={onChange} dialogs={dialogs} />
          <XStack flexWrap="wrap" gap="2">
            {DAYS_PRESETS.map((p) => (
              <Chip key={p.label} label={p.label} on={isDays(draft, p)} onPress={() => onChange({ ...draft, days: [...p.days] })} />
            ))}
          </XStack>
          <XStack flexWrap="wrap" gap="2">
            {WEEKDAYS.map((day) => (
              <Chip
                key={day}
                label={dayName(day)}
                on={draft.days.includes(day)}
                onPress={() => onChange(toggleDay(draft, day))}
                role="checkbox"
              />
            ))}
          </XStack>
          <Note>{DAYS_HINT}</Note>
        </YStack>
      ) : null}
      {problems.map((p) => (
        <Note key={p} tone="error">
          {p}
        </Note>
      ))}
    </YStack>
  );
}

// The time: a box that opens Android's time dialog, or, without the
// dialogs, typed and tidied to "HH:MM" when you leave the field.
function TimeField({ draft, onChange, dialogs }: { draft: Draft; onChange: (d: Draft) => void; dialogs: boolean }) {
  if (dialogs) {
    return (
      <PickBox
        value={parseClock(draft.time) ?? draft.time}
        accessibilityLabel="Time"
        onPress={async () => {
          const time = await pickTime(parseClock(draft.time) ?? '09:00');
          if (time) onChange({ ...draft, time });
        }}
      />
    );
  }
  return (
    <AppInput
      value={draft.time}
      onChangeText={(time) => onChange({ ...draft, time })}
      onBlur={() => {
        const time = parseClock(draft.time);
        if (time && time !== draft.time) onChange({ ...draft, time });
      }}
      placeholder={TIME_PLACEHOLDER}
      keyboardType="numbers-and-punctuation"
      width={120}
      fontFamily="mono"
      accessibilityLabel="Time, 24-hour clock"
    />
  );
}
