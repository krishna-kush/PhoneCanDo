import { useEffect, useRef } from 'react';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { XStack, YStack } from 'tamagui';
import { WEEKDAYS } from '../../../../engine/schedule/parse';
import type { Weekday } from '../../../../engine/schedule/types';
import { HIT } from '../../../common/globals';
import PlainText from '../../../common/PlainText';
import { useReduceMotion } from '../../../common/useReduceMotion';
import { dayName } from '../../logic/clock';

// A pop that overshoots, as a day ringed on a calendar.
const POP = { damping: 9, stiffness: 300 };

type Props = { days: readonly Weekday[]; onToggle: (day: Weekday) => void };

// A daily one's days as a week on a calendar's strip, Monday first: a tap
// picks a day or takes it back, and a picked day pops in red. With none
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
  const reduce = useReduceMotion();
  const pop = useSharedValue(1);
  const was = useRef(on);

  useEffect(() => {
    if (was.current === on) return;
    was.current = on;
    if (reduce || !on) return;
    pop.value = 0.7;
    pop.value = withSpring(1, POP);
  }, [on, reduce, pop]);

  const style = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));
  const name = dayName(day);

  return (
    <Animated.View style={[{ flex: 1 }, style]}>
      <YStack
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
    </Animated.View>
  );
}
