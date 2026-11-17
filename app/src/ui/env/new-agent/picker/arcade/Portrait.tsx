import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { YStack } from 'tamagui';
import type { Look } from '../../../../../../../mascot/look.ts';
import type { Offer } from '../../../../../engine/agents/offers';
import { agentKind } from '../../../../../engine/agents/registry';
import StillFace from '../../../../common/face/StillFace';
import PlainText from '../../../../common/PlainText';
import { useReduceMotion } from '../../../../common/useReduceMotion';
import { coinOf } from '../logic/coin';
import { applicantLabel } from '../logic/facts';
import Coin from './Coin';

/** A tap's pop: up past its size, then a spring back. */
const POP = { damping: 9, stiffness: 320 };
/** The corner coin's size, and how far in from the corner it sits, in dp. */
const COIN = 9;
const COIN_AT = 5;

type Props = {
  offer: Offer;
  look: Look | undefined;
  picked: boolean;
  /** VS mode's challenger. */
  challenger?: boolean;
  onSelect: () => void;
  /** A hold: put it up against the pick (VS mode); none when it can't be. */
  onChallenge?: () => void;
};

// One portrait in the arcade's grid, a radio button: the applicant's face
// over its name, and in its top corner its coin when it plays free (the
// stat key at the page's foot says which). Picked, it smiles in a red frame
// with the cursor's corner ticks round it; VS mode's challenger the same in
// amber. A tap pops it;
// a hold pops it too and challenges the pick with it. One that can't work
// here sleeps, dimmed, and can't be picked.
export default function Portrait({ offer, look, picked, challenger = false, onSelect, onChallenge }: Props) {
  const reduce = useReduceMotion();
  const blocked = offer.blocked != null;
  const kind = agentKind(offer.id);
  const coin = coinOf(kind);
  const pop = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));
  const popIt = () => {
    if (!reduce) pop.value = withSequence(withTiming(1.12, { duration: 90 }), withSpring(1, POP));
  };
  const press = () => {
    popIt();
    onSelect();
  };
  const hold = (then: () => void) => {
    popIt();
    then();
  };
  return (
    <Animated.View style={[{ flex: 1, minWidth: 0 }, style]}>
      <YStack
        alignItems="center"
        gap={6}
        paddingTop="3"
        paddingBottom="2"
        paddingHorizontal={2}
        borderWidth={1}
        borderColor={picked ? 'primary' : challenger ? 'secondary' : 'line'}
        backgroundColor={picked ? 'primarySoft' : challenger ? 'secondarySoft' : blocked ? 'bg' : 'panel press:panel2'}
        opacity={blocked ? 0.45 : 1}
        onPress={blocked || picked || challenger ? undefined : press}
        onLongPress={blocked || picked || challenger || !onChallenge ? undefined : () => hold(onChallenge)}
        accessibilityRole="radio"
        accessibilityState={{ checked: picked, disabled: blocked }}
        accessibilityLabel={challenger ? `${applicantLabel(offer, kind)}, the challenger` : applicantLabel(offer, kind)}
      >
        {coin === 'slot' ? null : (
          <YStack position="absolute" top={COIN_AT} right={COIN_AT}>
            <Coin coin={coin} size={COIN} />
          </YStack>
        )}
        <YStack height={40} justifyContent="flex-end">
          <StillFace mood={picked || challenger ? 'happy' : blocked ? 'asleep' : 'awake'} size={22} mascot={look} />
        </YStack>
        <PlainText
          fontFamily="mono"
          fontSize={10}
          textAlign="center"
          numberOfLines={2}
          color={picked ? 'primary' : challenger ? 'secondaryInk' : blocked ? 'faint' : 'fg'}
        >
          {offer.label}
        </PlainText>
        {picked ? <Cursor ink="primary" /> : challenger ? <Cursor ink="secondary" /> : null}
      </YStack>
    </Animated.View>
  );
}

/** How far the corner ticks sit out from the frame, and their arms, in dp. */
const OUT = 5;
const ARM = 9;

// A cursor on a portrait: a corner tick out at each corner, as the site's
// registration ticks; the pick's red, the challenger's amber.
function Cursor({ ink }: { ink: 'primary' | 'secondary' }) {
  const corner = { position: 'absolute', width: ARM, height: ARM, borderColor: ink } as const;
  return (
    <>
      <YStack {...corner} top={-OUT} left={-OUT} borderTopWidth={2} borderLeftWidth={2} />
      <YStack {...corner} top={-OUT} right={-OUT} borderTopWidth={2} borderRightWidth={2} />
      <YStack {...corner} bottom={-OUT} left={-OUT} borderBottomWidth={2} borderLeftWidth={2} />
      <YStack {...corner} bottom={-OUT} right={-OUT} borderBottomWidth={2} borderRightWidth={2} />
    </>
  );
}
