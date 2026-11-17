import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { XStack, YStack } from 'tamagui';
import AgentFace from '../../common/face/AgentFace';
import type { Mood } from '../../common/face/mood';
import { useTheme } from '../../common/globals';
import PlainText from '../../common/PlainText';
import TextAction from '../../drawer/select/TextAction';
import { STOP, TUCK_LABEL } from './copy';
import { GLIDE } from './glide';
import { GUIDE_LOOK, GUIDE_SERIAL } from './guide';

/** The bubble's margin from the screen's sides. */
export const SIDE = 12;
/** Its arrow's half width, and how close to its ends it may point. */
const ARROW = 7;
export const ARROW_INSET = 20;

const POP = { damping: 12, stiffness: 260 };

type Props = {
  /** Where its top edge goes; null keeps it where it is (its spot still moving). */
  top: number | null;
  /** Where it starts when it has no place yet. */
  startTop: number;
  width: number;
  /** Its arrow toward the frame: on which edge and how far along; none without a frame on screen. */
  arrow: { edge: 'top' | 'bottom'; x: number } | null;
  kicker: string;
  caption: string;
  line: string;
  /** A last mono line: the spot is scrolled out of sight. */
  hint?: string | null;
  mood: Mood;
  reduce: boolean;
  onHeight: (height: number) => void;
  onStop: () => void;
  onTuck: () => void;
};

// The guide's bubble: A-09's face and serial (guide.ts; a tap on the face
// tucks the bubble away), where you are on the walk with its caption
// beside it, then what to tap. It glides to its place above or below the
// thing to tap and points at it.
export default function WalkBubble({
  top,
  startTop,
  width,
  arrow,
  kicker,
  caption,
  line,
  hint,
  mood,
  reduce,
  onHeight,
  onStop,
  onTuck,
}: Props) {
  const t = useTheme();
  const y = useSharedValue(top ?? startTop);
  const pop = useSharedValue(0);
  // Laid out once: its height is known, so where it starts is right.
  const [laid, setLaid] = useState(false);

  // It pops in where it starts once laid out, then glides to each place it is given.
  useEffect(() => {
    if (!laid) return;
    y.value = top ?? startTop;
    pop.value = reduce ? 1 : withSpring(1, POP);
    // Once, as it is first laid out.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [laid]);
  useEffect(() => {
    if (top == null || !laid) return;
    y.value = reduce ? top : withTiming(top, GLIDE);
  }, [top, reduce, y, laid]);

  const style = useAnimatedStyle(() => ({
    opacity: Math.min(1, pop.value),
    transform: [{ translateY: y.value }, { scale: 0.92 + 0.08 * pop.value }],
  }));

  return (
    <Animated.View
      style={[{ position: 'absolute', left: SIDE, top: 0, width }, style]}
      onLayout={(e) => {
        onHeight(e.nativeEvent.layout.height);
        setLaid(true);
      }}
    >
      <YStack backgroundColor="panel" borderWidth={1} borderColor="lineStrong" boxShadow="3px 3px 0 secondary" padding="3" gap="2">
        {arrow ? (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: arrow.x - ARROW,
              [arrow.edge]: -ARROW,
              width: ARROW * 2,
              height: ARROW * 2,
              backgroundColor: t.panel,
              borderColor: t.lineStrong,
              borderTopWidth: arrow.edge === 'top' ? 1 : 0,
              borderLeftWidth: arrow.edge === 'top' ? 1 : 0,
              borderBottomWidth: arrow.edge === 'bottom' ? 1 : 0,
              borderRightWidth: arrow.edge === 'bottom' ? 1 : 0,
              transform: [{ rotate: '45deg' }],
            }}
          />
        ) : null}
        <XStack alignItems="center" gap="2">
          <Pressable onPress={onTuck} hitSlop={10} accessibilityRole="button" accessibilityLabel={TUCK_LABEL}>
            <AgentFace mood={mood} mascot={GUIDE_LOOK} size={24} />
          </Pressable>
          <PlainText fontFamily="mono" fontSize={11} fontWeight="600" letterSpacing={1.4} color="secondaryInk">
            {`${GUIDE_SERIAL} ·`}
          </PlainText>
          <PlainText flexShrink={1} fontFamily="mono" fontSize={11} letterSpacing={1.4} color="dim" textTransform="uppercase" numberOfLines={1}>
            {kicker}
          </PlainText>
          <PlainText flex={1} fontFamily="mono" fontSize={11} letterSpacing={1.4} color="secondaryInk" textTransform="uppercase" numberOfLines={1}>
            {`· ${caption}`}
          </PlainText>
          <TextAction label={STOP} onPress={onStop} />
        </XStack>
        <PlainText fontSize={15}>{line}</PlainText>
        {hint ? (
          <PlainText fontFamily="mono" fontSize={12} color="secondaryInk">
            {hint}
          </PlainText>
        ) : null}
      </YStack>
    </Animated.View>
  );
}
