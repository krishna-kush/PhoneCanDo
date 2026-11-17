import { XStack, YStack } from 'tamagui';
import { pickDate } from '../../../../engine/pick';
import { addDays, dayTile, startOfDay } from '../../logic/clock';
import type { Draft } from '../../logic/draft';
import { ONCE_MAX_AHEAD_DAYS } from '../../logic/limits';
import { isOnceAt, oncePresets, withOnceAt } from '../../logic/presets';
import { Chip } from '../Chip';
import PickBox from '../PickBox';
import TimeTiles from './TimeTiles';

type Props = { draft: Draft; onChange: (d: Draft) => void; now: number; dialogs: boolean };

// A one-off: its day and time on split-flap tiles that open Android's own
// dialogs, and the quick times under them. A build without the dialogs
// shows the day (the quick times change it) and types the time.
export default function OnceFields({ draft, onChange, now, dialogs }: Props) {
  const tile = dayTile(draft.day, now);
  return (
    <YStack gap="3">
      <XStack gap="2" alignItems="center">
        <PickBox
          value={tile.date}
          over={tile.near}
          size={16}
          accessibilityLabel="Day"
          onPress={
            dialogs
              ? async () => {
                  const day = await pickDate(draft.day, startOfDay(now), addDays(now, ONCE_MAX_AHEAD_DAYS));
                  if (day != null) onChange({ ...draft, day });
                }
              : undefined
          }
        />
        <TimeTiles draft={draft} onChange={onChange} dialogs={dialogs} />
      </XStack>
      <XStack flexWrap="wrap" gap="2">
        {oncePresets(now).map((p) => (
          <Chip key={p.label} label={p.label} on={isOnceAt(draft, p.at)} onPress={() => onChange(withOnceAt(draft, p.at))} />
        ))}
      </XStack>
    </YStack>
  );
}
