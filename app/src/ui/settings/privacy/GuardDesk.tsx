import { useState } from 'react';
import { XStack, YStack } from 'tamagui';
import BoopFace from '../../common/face/BoopFace';
import type { Reaction } from '../../common/face/motion';
import PlainText from '../../common/PlainText';
import LiveLight from '../../common/rows/LiveLight';
import { ROW_GUTTER } from '../../common/rows/place';
import RowFrame from '../../common/rows/RowFrame';
import { usePageActive } from '../../nav/pageActive';
import { guardLine } from './copy';

type Props = {
  ready: boolean;
  enabled: boolean;
  /** A long press on the desk shows our test phones' switch, as the old card did. */
  onLongPress: () => void;
};

// The top of the declaration: A-01 at the customs desk. With usage stats on
// it is on duty, eyes open, a red light blinking; off, its eyes are shut
// and it looks away. Flipping the switch, it dozes off at the desk or
// comes to (common/face's doze and wake); the page opening and the switch
// being read play nothing. A tap makes it hop.
export default function GuardDesk({ ready, enabled, onLongPress }: Props) {
  const active = usePageActive();
  const { title, line } = guardLine(ready, enabled);
  const onDuty = ready && enabled;
  // How it got to its state: a flip of the switch once the page is read
  // plays one, none before; once another page covers this one it is
  // dropped, so coming back shows the state, not the flip again.
  const [duty, setDuty] = useState<{ onDuty: boolean; ready: boolean; reaction?: Reaction }>({ onDuty, ready });
  if (duty.onDuty !== onDuty || duty.ready !== ready) {
    setDuty({ onDuty, ready, reaction: duty.ready && ready ? (onDuty ? 'wake' : 'doze') : undefined });
  } else if (!active && duty.reaction) {
    setDuty({ onDuty, ready });
  }
  return (
    <RowFrame bare>
      <XStack
        alignItems="center"
        gap="3"
        paddingHorizontal={ROW_GUTTER}
        paddingVertical="3"
        onLongPress={onLongPress}
        accessibilityLabel={`${title}. ${line}`}
      >
        <BoopFace mood={onDuty ? 'awake' : 'asleep'} reaction={duty.reaction} size={26} still={!active} label="A-01, the guard. Tap it." />
        <YStack flex={1} minWidth={0} gap={3}>
          <XStack alignItems="center" gap="2">
            {onDuty ? <LiveLight still={!active} /> : null}
            <PlainText
              fontFamily="mono"
              fontSize={11}
              letterSpacing={1.4}
              textTransform="uppercase"
              color={onDuty ? 'secondaryInk' : 'dim'}
              numberOfLines={1}
            >
              {title}
            </PlainText>
          </XStack>
          <PlainText fontSize={13} color="muted">
            {line}
          </PlainText>
        </YStack>
      </XStack>
    </RowFrame>
  );
}
