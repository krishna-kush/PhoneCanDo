import { XStack, YStack } from 'tamagui';
import type { Timing } from '../../../../engine/schedule/types';
import AppInput from '../../../common/AppInput';
import Note from '../../../env/parts/Note';
import { type Draft, type EveryUnit, everyMinutes } from '../../logic/draft';
import { EVERY_HINT, UNIT_WORDS } from '../../logic/editorCopy';
import { EVERY_PRESETS, isEvery } from '../../logic/presets';
import { Chip, ChoiceChips } from '../Chip';
import DayRuler from './DayRuler';

type Props = { draft: Draft; onChange: (d: Draft) => void; now: number; timing: Timing | null };

const UNIT_OPTIONS = (['min', 'hours'] as const).map((value) => ({ value, label: UNIT_WORDS[value] }));

// Every so often: a quick interval, or any number of minutes or hours on
// a tile, then the next day of runs on a ruler (DayRuler).
export default function EveryFields({ draft, onChange, now, timing }: Props) {
  return (
    <YStack gap="3">
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
          width={88}
          fontSize={22}
          fontFamily="mono"
          textAlign="center"
          backgroundColor="panel2"
          accessibilityLabel="Every how many"
        />
        <ChoiceChips<EveryUnit> options={UNIT_OPTIONS} value={draft.unit} onPick={(unit) => onChange({ ...draft, unit })} />
      </XStack>
      <DayRuler timing={timing?.type === 'every' ? timing : null} now={now} minutes={everyMinutes(draft)} />
      <Note>{EVERY_HINT}</Note>
    </YStack>
  );
}
