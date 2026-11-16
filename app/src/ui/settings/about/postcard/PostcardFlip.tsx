import { type ReactNode, useState } from 'react';
import { StyleSheet } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, { cancelAnimation, useAnimatedReaction, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import Svg, { Line, Path } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';
import { YStack } from 'tamagui';
import { useTheme } from '../../../common/globals';
import { useReduceMotion } from '../../../common/useReduceMotion';
import PostcardBack from './PostcardBack';
import { dragAngle, nearestSide, showsBack, turnSpeed, turnTarget } from './turn';

// A settle that lands with one small, quick wobble at most (about 2% past).
const SETTLE = { damping: 20, stiffness: 170 };
// How far a finger moves sideways (or up and down) before the turn takes
// it (or lets the page scroll), in dp.
const SLOP = 12;
// The folded corner's side, in dp.
const CORNER = 36;

// The spec plate with a postcard on its back. Swipe it sideways and it
// turns under the finger, the way the swipe goes; let go past a third of
// the way, or with a flick, and it turns over, else it settles back
// (turn.ts). A tap on its folded corner turns it over too, and a tap on
// the postcard turns it back. Up and down still scroll the page. Each face
// shows for its half of the turn.
export default function PostcardFlip({ children }: { children: ReactNode }) {
  const t = useTheme();
  const reduce = useReduceMotion();
  const [over, setOver] = useState(false);
  const angle = useSharedValue(0);
  const start = useSharedValue(0);
  const side = useSharedValue(0);
  const width = useSharedValue(0);

  useAnimatedReaction(
    () => showsBack(angle.value),
    (back, was) => {
      if (back !== was) scheduleOnRN(setOver, back);
    },
  );

  const swipe = usePanGesture({
    activeOffsetX: [-SLOP, SLOP],
    failOffsetY: [-SLOP, SLOP],
    onActivate: () => {
      cancelAnimation(angle);
      start.value = angle.value;
      side.value = nearestSide(angle.value);
    },
    onUpdate: (e) => {
      angle.value = dragAngle(start.value, e.translationX, width.value);
    },
    onDeactivate: (e) => {
      const speed = turnSpeed(e.velocityX, width.value);
      const to = turnTarget(side.value, angle.value, speed);
      angle.value = reduce ? to : withSpring(to, { ...SETTLE, velocity: speed });
    },
  });

  const turn = (half: 1 | -1) => {
    const to = nearestSide(angle.value) + half * 180;
    angle.value = reduce ? to : withSpring(to, SETTLE);
  };

  const front = useAnimatedStyle(() => ({
    opacity: showsBack(angle.value) ? 0 : 1,
    transform: [{ perspective: 900 }, { rotateY: `${angle.value}deg` }],
  }));
  const back = useAnimatedStyle(() => ({
    opacity: showsBack(angle.value) ? 1 : 0,
    transform: [{ perspective: 900 }, { rotateY: `${angle.value + 180}deg` }],
  }));

  return (
    <GestureDetector gesture={swipe}>
      <YStack onLayout={(e) => (width.value = e.nativeEvent.layout.width)}>
        <Animated.View style={front} pointerEvents={over ? 'none' : 'auto'}>
          {children}
          <YStack
            position="absolute"
            right={5}
            bottom={5}
            onPress={() => turn(1)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Turn the plate over"
          >
            <Svg width={CORNER} height={CORNER}>
              <Path d={`M${CORNER} 0 L${CORNER} ${CORNER} L0 ${CORNER} Z`} fill={t.panel2} />
              <Path d={`M${CORNER} 0 L0 ${CORNER}`} stroke={t.lineStrong} strokeWidth={1} />
              <Line x1={CORNER - 13} y1={CORNER - 6} x2={CORNER - 6} y2={CORNER - 6} stroke={t.secondaryInk} strokeWidth={1.4} />
              <Path
                d={`M${CORNER - 9} ${CORNER - 10} L${CORNER - 6} ${CORNER - 6} L${CORNER - 9} ${CORNER - 2}`}
                stroke={t.secondaryInk}
                strokeWidth={1.4}
                fill="none"
              />
            </Svg>
          </YStack>
        </Animated.View>
        <Animated.View style={[StyleSheet.absoluteFill, back]} pointerEvents={over ? 'auto' : 'none'}>
          <PostcardBack onTurnBack={() => turn(-1)} />
        </Animated.View>
      </YStack>
    </GestureDetector>
  );
}
