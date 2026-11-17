import { XStack, YStack } from 'tamagui';
import BoopFace from '../../common/face/BoopFace';
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
// comes to (the face plays every change of mood); the page opening and
// the switch being read play nothing (a face takes the mood it is given
// in its first moment at once). A tap makes it hop.
export default function GuardDesk({ ready, enabled, onLongPress }: Props) {
  const active = usePageActive();
  const { title, line } = guardLine(ready, enabled);
  const onDuty = ready && enabled;
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
        <BoopFace mood={onDuty ? 'awake' : 'asleep'} size={26} still={!active} label="A-01, the guard. Tap it." />
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
