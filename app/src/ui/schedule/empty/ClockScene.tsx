import { useState } from 'react';
import { XStack } from 'tamagui';
import AgentFace from '../../common/face/AgentFace';
import type { Nap } from '../../common/face/useNap';
import AlarmClock from '../clock/AlarmClock';
import { EMPTY_FACE } from '../logic/emptyCopy';

type Props = { nap: Nap; still: boolean };

// The live alarm clock with nothing set and A-01 asleep against it. A tap
// on either rings it and jolts A-01 awake.
export default function ClockScene({ nap, still }: Props) {
  const [rings, setRings] = useState(0);
  const ring = () => {
    const n = rings + 1;
    setRings(n);
    nap.boop(n);
  };
  return (
    <XStack onPress={ring} hitSlop={12} accessibilityRole="button" accessibilityLabel={EMPTY_FACE.clock} alignItems="flex-end" gap="1">
      <AlarmClock rings={rings} still={still} />
      <AgentFace mood={nap.mood} size={26} hop={rings} still={still} />
    </XStack>
  );
}
