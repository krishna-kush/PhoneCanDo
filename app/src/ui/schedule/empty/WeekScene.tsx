import { XStack, YStack } from 'tamagui';
import BoopFace from '../../common/face/BoopFace';
import type { Nap } from '../../common/face/useNap';
import PlainText from '../../common/PlainText';
import { EMPTY_FACE, weekAhead } from '../logic/emptyCopy';

type Props = { nap: Nap; still: boolean; now: number };

// The week ahead as seven blank day tiles, today's in amber with A-01
// napping on it: nothing on any of them. A tap wakes it.
export default function WeekScene({ nap, still, now }: Props) {
  return (
    <XStack gap={4} alignItems="flex-end">
      {weekAhead(now).map(({ day, today }) => (
        <YStack key={day} alignItems="center" gap={3}>
          {today ? (
            <BoopFace mood={nap.mood} size={26} still={still} label={EMPTY_FACE.week} onBoop={nap.boop} hitSlop={16} />
          ) : null}
          <PlainText fontFamily="mono" fontSize={9} letterSpacing={1} textTransform="uppercase" color={today ? 'secondaryInk' : 'faint'}>
            {day}
          </PlainText>
          <YStack
            width={32}
            height={40}
            borderWidth={1}
            borderStyle="dashed"
            borderColor={today ? 'secondary' : 'line'}
            backgroundColor={today ? 'secondarySoft' : 'bg'}
          />
        </YStack>
      ))}
    </XStack>
  );
}
