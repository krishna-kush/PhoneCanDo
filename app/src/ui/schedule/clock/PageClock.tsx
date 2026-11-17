import { useState } from 'react';
import { YStack } from 'tamagui';
import { PAGE_CLOCK } from '../logic/scheduleCopy';
import AlarmClock from './AlarmClock';

// The Schedules page's foot, once it lists any: the live alarm clock,
// telling the time; a tap rings it.
export default function PageClock({ still }: { still: boolean }) {
  const [rings, setRings] = useState(0);
  return (
    <YStack alignItems="center" paddingTop="4" paddingBottom="2">
      <YStack onPress={() => setRings((n) => n + 1)} hitSlop={12} accessibilityRole="button" accessibilityLabel={PAGE_CLOCK}>
        <AlarmClock rings={rings} still={still} />
      </YStack>
    </YStack>
  );
}
