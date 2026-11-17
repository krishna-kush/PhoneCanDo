import { useState } from 'react';
import { YStack } from 'tamagui';
import AppButton from '../../common/AppButton';
import { useNap } from '../../common/face/useNap';
import PlainText from '../../common/PlainText';
import KeyHead from '../../common/rows/KeyHead';
import { ROW_GUTTER } from '../../common/rows/place';
import Spot from '../../common/spot/Spot';
import { EMPTY_CAPTION, EMPTY_TITLE, pickLook } from '../logic/emptyCopy';
import { saveLabel } from '../logic/scheduleCopy';
import ClockScene from './ClockScene';
import WeekScene from './WeekScene';

type Props = {
  /** The plain line: nothing yet, for every agent or one. */
  text: string;
  canAdd: boolean;
  onAdd: () => void;
  /** The page out of sight: the faces rest. */
  still: boolean;
  now: number;
};

// The Schedules page with nothing on it: one key box with A-01 napping in
// a scene (the blank week or the live alarm clock, picked at random as the
// page opens and kept while it is open), the plain line, its caption and
// Add schedule. A tap wakes it for a moment (useNap).
export default function EmptySchedules({ text, canAdd, onAdd, still, now }: Props) {
  const [look] = useState(() => pickLook(Math.random()));
  const nap = useNap();
  return (
    <YStack overflow="hidden" borderWidth={1} borderColor="line" backgroundColor="panel">
      <KeyHead title={EMPTY_TITLE} barcode="schedulesEmpty" />
      <YStack alignItems="center" gap="3" paddingHorizontal={ROW_GUTTER} paddingTop="5" paddingBottom="4">
        {look === 'week' ? <WeekScene nap={nap} still={still} now={now} /> : <ClockScene nap={nap} still={still} />}
        <PlainText fontSize={14} color="muted" textAlign="center">
          {text}
        </PlainText>
        <PlainText fontFamily="mono" fontSize={10} letterSpacing={1.4} textTransform="uppercase" color="faint" textAlign="center">
          {nap.up ? EMPTY_CAPTION[look].up : EMPTY_CAPTION[look].asleep}
        </PlainText>
        {canAdd ? (
          <YStack alignSelf="stretch" marginTop="1">
            <Spot id="schedules.addFirst">
              <AppButton onPress={onAdd}>{saveLabel(false)}</AppButton>
            </Spot>
          </YStack>
        ) : null}
      </YStack>
    </YStack>
  );
}
