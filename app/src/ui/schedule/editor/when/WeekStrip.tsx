import { XStack, YStack } from 'tamagui';
import { WEEKDAYS } from '../../../../engine/schedule/parse';
import type { Weekday } from '../../../../engine/schedule/types';
import { HIT } from '../../../common/globals';
import PlainText from '../../../common/PlainText';
import { dayName } from '../../logic/clock';

type Props = { days: readonly Weekday[]; onToggle: (day: Weekday) => void };

// A daily one's days as a week on a calendar's strip, Monday first: a tap
// picks a day or takes it back, and a picked day fills red. With none
// picked every day glows faintly amber, since it then runs every day.
export default function WeekStrip({ days, onToggle }: Props) {
  const all = days.length === 0;
  return (
    <XStack gap="1">
      {WEEKDAYS.map((day) => (
        <DayCell key={day} day={day} on={days.includes(day)} lit={all} onPress={() => onToggle(day)} />
      ))}
    </XStack>
  );
}

function DayCell({ day, on, lit, onPress }: { day: Weekday; on: boolean; lit: boolean; onPress: () => void }) {
  const name = dayName(day);
  return (
    <YStack
      flex={1}
      height={HIT.minTouch}
      alignItems="center"
      justifyContent="center"
      borderWidth={1}
      borderColor={on ? 'primary' : lit ? 'secondaryLine' : 'lineStrong'}
      backgroundColor={on ? 'primary' : lit ? 'secondarySoft' : 'bg'}
      opacity="press:0.7"
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: on }}
      accessibilityLabel={name}
    >
      <PlainText fontFamily="mono" fontSize={12} fontWeight="600" color={on ? 'onPrimary' : lit ? 'secondaryInk' : 'fg'}>
        {name.slice(0, 2)}
      </PlainText>
    </YStack>
  );
}
