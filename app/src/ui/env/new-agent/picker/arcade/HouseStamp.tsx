import { useEffect } from 'react';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated';
import { YStack } from 'tamagui';
import PlainText from '../../../../common/PlainText';
import { useReduceMotion } from '../../../../common/useReduceMotion';
import { HOUSE_PICK } from '../copy';

/** Its lean, in degrees: a stamp never lands quite straight. */
const LEAN = -8;
/** A landing: from big and twisted, after the face's hop, down with a bounce. */
const FROM = { scale: 1.9, turn: -14 };
const LAND_AFTER_MS = 120;
const LAND = { damping: 11, stiffness: 260 };

type Props = {
  /** The grid's: small, its two words stacked. */
  small?: boolean;
  /** Lands as it comes up (the showcase's, each time the house pick is picked); else it is just there. */
  lands?: boolean;
};

// The house pick's stamp, on the kind a fresh install starts with, as the
// site's Built in stamp on a card: red ink in a double frame, leaning, in
// mono capitals. The grid's sits small in a portrait's top corner, across
// from its coin; the showcase's lands, big and twisted down onto the plate
// (just there with reduce motion). A screen reader hears the grid's in its
// portrait's own label, so not twice.
export default function HouseStamp({ small = false, lands = false }: Props) {
  const reduce = useReduceMotion();
  const landing = lands && !reduce;
  const scale = useSharedValue(landing ? FROM.scale : 1);
  const turn = useSharedValue(landing ? FROM.turn : 0);
  const shown = useSharedValue(landing ? 0 : 1);
  useEffect(() => {
    if (!landing) return;
    shown.value = withDelay(LAND_AFTER_MS, withTiming(1, { duration: 90 }));
    scale.value = withDelay(LAND_AFTER_MS, withSpring(1, LAND));
    turn.value = withDelay(LAND_AFTER_MS, withSpring(0, LAND));
  }, [landing, scale, turn, shown]);
  const style = useAnimatedStyle(() => ({
    opacity: shown.value,
    transform: [{ rotate: `${LEAN + turn.value}deg` }, { scale: scale.value }],
  }));
  return (
    <Animated.View
      style={style}
      pointerEvents="none"
      accessibilityElementsHidden={small}
      importantForAccessibility={small ? 'no-hide-descendants' : 'auto'}
    >
      <YStack borderWidth={1} borderColor="primary" padding={small ? 1 : 2} backgroundColor="panel">
        <YStack borderWidth={1} borderColor="primary" paddingHorizontal={small ? 3 : 6} paddingVertical={small ? 1 : 2}>
          <PlainText
            fontFamily="mono"
            fontSize={small ? 7 : 10}
            fontWeight="600"
            letterSpacing={small ? 0.6 : 1.4}
            color="primary"
            textTransform="uppercase"
            textAlign="center"
          >
            {small ? HOUSE_PICK.replace(' ', '\n') : HOUSE_PICK}
          </PlainText>
        </YStack>
      </YStack>
    </Animated.View>
  );
}
