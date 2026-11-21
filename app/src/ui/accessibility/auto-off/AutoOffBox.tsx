import { useState } from 'react';
import { XStack, YStack } from 'tamagui';
import PlainText from '../../common/PlainText';
import RowFrame from '../../common/rows/RowFrame';
import RowGroup from '../../common/rows/RowGroup';
import SquareMark from '../../common/rows/SquareMark';
import { usePageActive } from '../../nav/pageActive';
import AutoOffHead from './AutoOffHead';
import { BOX_CAPTION, BOX_TITLE, boxBody, boxTitle, CATCH, flipLine, SAVE_FAILED } from './copy';
import TimeCard from './TimeCard';
import type { AutoOff } from './useAutoOff';

// Settings → Phone control's Auto off, its own key box under the panel, as
// a switch: A-01 sweating over the shy bank apps while
// it is off, happy once it clocks out by itself. The whole box flips it:
// A-01 hops and quips in place of its caption, its time card punches OUT
// (or un-punches) and the stamp slams, while its square mark just fills or
// empties, with no pop; when it clocks out, and what it costs once on.
export default function AutoOffBox({ auto }: { auto: AutoOff }) {
  const still = !usePageActive();
  const [flips, setFlips] = useState(0);

  function flip() {
    auto.toggle();
    setFlips((n) => n + 1);
  }

  return (
    <RowGroup title={BOX_TITLE} barcode="autoOff">
      <RowFrame
        press={{ onPress: flip, role: 'switch', label: BOX_TITLE, hint: boxBody(auto.on), state: { checked: auto.on } }}
      >
        <YStack gap="3">
          <XStack alignItems="center" gap="3">
            <YStack flex={1} minWidth={0}>
              <AutoOffHead
                mood={auto.on ? 'happy' : 'sweaty'}
                title={boxTitle(auto.on)}
                caption={flips > 0 ? flipLine(auto.on, flips) : BOX_CAPTION}
                hop={flips}
                still={still}
              />
            </YStack>
            <SquareMark on={auto.on} instant />
          </XStack>
          <PlainText fontSize={14} color={auto.failed ? 'primary' : 'muted'}>
            {auto.failed ? SAVE_FAILED : boxBody(auto.on)}
          </PlainText>
          <TimeCard on={auto.on} />
          {auto.on ? (
            <PlainText fontSize={13} color="muted">
              {CATCH}
            </PlainText>
          ) : null}
        </YStack>
      </RowFrame>
    </RowGroup>
  );
}
