import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { YStack } from 'tamagui';
import type { Look } from '../../../../../../../mascot/look.ts';
import type { Offer } from '../../../../../engine/agents/offers';
import { agentKind } from '../../../../../engine/agents/registry';
import StillFace from '../../../../common/face/StillFace';
import P1Flag from '../../../../common/P1Flag';
import PlainText from '../../../../common/PlainText';
import { useReduceMotion } from '../../../../common/useReduceMotion';
import { usePageActive } from '../../../../nav/pageActive';
import { applicantLabel } from '../logic/facts';

/** A tap's pop: up past its size, then a spring back. */
const POP = { damping: 9, stiffness: 320 };

type Props = { offer: Offer; look: Look | undefined; picked: boolean; onSelect: () => void };

// One portrait in the arcade's grid, a radio button: the applicant's face
// over its name. Picked, it smiles in a red frame with the cursor's corner
// ticks round it and the P1 flag on its top edge; a tap pops it. One that
// can't work here sleeps, dimmed, and can't be picked.
export default function Portrait({ offer, look, picked, onSelect }: Props) {
  const reduce = useReduceMotion();
  const blocked = offer.blocked != null;
  const pop = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));
  const press = () => {
    if (!reduce) pop.value = withSequence(withTiming(1.12, { duration: 90 }), withSpring(1, POP));
    onSelect();
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
        borderColor={picked ? 'primary' : 'line'}
        backgroundColor={picked ? 'primarySoft' : blocked ? 'bg' : 'panel press:panel2'}
        opacity={blocked ? 0.45 : 1}
        onPress={blocked || picked ? undefined : press}
        accessibilityRole="radio"
        accessibilityState={{ checked: picked, disabled: blocked }}
        accessibilityLabel={applicantLabel(offer, agentKind(offer.id))}
      >
        <YStack height={40} justifyContent="flex-end">
          <StillFace mood={picked ? 'happy' : blocked ? 'asleep' : 'awake'} size={22} mascot={look} />
        </YStack>
        <PlainText
          fontFamily="mono"
          fontSize={10}
          textAlign="center"
          numberOfLines={2}
          color={picked ? 'primary' : blocked ? 'faint' : 'fg'}
        >
          {offer.label}
        </PlainText>
        {picked ? <Cursor /> : null}
      </YStack>
    </Animated.View>
  );
}

/** How far the corner ticks sit out from the frame, and their arms, in dp. */
const OUT = 5;
const ARM = 9;

// The cursor on the picked portrait: a red corner tick out at each corner,
// as the site's registration ticks, and the P1 flag on the top edge.
function Cursor() {
  const active = usePageActive();
  const corner = { position: 'absolute', width: ARM, height: ARM, borderColor: 'primary' } as const;
  return (
    <>
      <YStack {...corner} top={-OUT} left={-OUT} borderTopWidth={2} borderLeftWidth={2} />
      <YStack {...corner} top={-OUT} right={-OUT} borderTopWidth={2} borderRightWidth={2} />
      <YStack {...corner} bottom={-OUT} left={-OUT} borderBottomWidth={2} borderLeftWidth={2} />
      <YStack {...corner} bottom={-OUT} right={-OUT} borderBottomWidth={2} borderRightWidth={2} />
      <YStack position="absolute" top={-8} left={6}>
        <P1Flag small still={!active} />
      </YStack>
    </>
  );
}
