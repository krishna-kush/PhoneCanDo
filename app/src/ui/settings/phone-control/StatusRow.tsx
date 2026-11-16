import { useEffect, useRef, useState } from 'react';
import { XStack, YStack } from 'tamagui';
import AgentFace from '../../common/face/AgentFace';
import PlainText from '../../common/PlainText';
import LiveLight from '../../common/rows/LiveLight';
import RowFrame from '../../common/rows/RowFrame';
import Stamp from '../../common/Stamp';
import { HANDS_STAMP, handsLine, handsMood, type HandsLevel } from './copy';

const ORDER: readonly HandsLevel[] = ['off', 'starting', 'ready', 'on'];

type Props = {
  level: HandsLevel;
  /** Ask mode: each agent asks for its own unlock. */
  asks: boolean;
  /** Its page is covered: the face holds still. */
  still: boolean;
};

// The panel's first row: A-01 at the controls, asleep while Accessibility
// is off, awake once it is on, with a live light while agents can see and
// tap the phone; a stamp for where it stands, slammed anew on each change
// while the page is open, and a caption adding up the two keys below. It
// hops as each key turns.
export default function StatusRow({ level, asks, still }: Props) {
  const [hop, setHop] = useState(0);
  const was = useRef(level);
  const [changed, setChanged] = useState(false);

  useEffect(() => {
    if (was.current === level) return;
    if (ORDER.indexOf(level) > ORDER.indexOf(was.current)) setHop((n) => n + 1);
    was.current = level;
    setChanged(true);
  }, [level]);

  return (
    <RowFrame>
      <XStack alignItems="center" gap="3">
        <AgentFace mood={handsMood(level)} size={30} hop={hop} still={still} />
        <YStack flex={1} minWidth={0} gap="2">
          <XStack alignItems="center" gap="2">
            {level === 'on' ? <LiveLight still={still} /> : null}
            <PlainText fontFamily="mono" fontSize={11} letterSpacing={1.2} color={level === 'on' ? 'primary' : 'secondaryInk'} textTransform="uppercase" flexShrink={1}>
              {handsLine(level, asks)}
            </PlainText>
          </XStack>
          <Stamp key={level} slam={changed} tone={level === 'on' ? 'primary' : 'secondary'}>
            {HANDS_STAMP[level]}
          </Stamp>
        </YStack>
      </XStack>
    </RowFrame>
  );
}
