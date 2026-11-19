import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { between, BLINK_EVERY_MS } from '../../common/face/motion';
import { useTheme } from '../../common/globals';
import type { Bunk } from './logic/bunks';

/** A bunk's bar; its shadow sits 1 down and right of it in the other ink. */
const W = 24;
const H = 4;
const EYE = 2;
/** How far the eyes run along the bar while held: from the right end to the left, where the drawer comes from. */
const LOOK_LEFT = -12;
/** How far a bunk lifts while held. */
const LIFT = -2;
/** Each bunk moves this long after the one above. */
const STAGGER_MS = 40;
/** Eyes shut: a slit. */
const SHUT = 0.5;
/** The drop back after the drawer shuts: a bounce. */
const DROP = { damping: 8, stiffness: 320 } as const;

// The drawer key's three bunks (logic/bunks.ts): each a bar in an agent's
// front ink over its shadow in the other, its eyes at the far end, open and
// blinking while it works, shut while it sleeps. Held (and while the drawer
// it opened stays open), they sit up one after another and look left; when
// the drawer shuts they drop back with a bounce. Still (Android's "Remove
// animations", or a page that is not in front): no blinks, no bounce.
export default function Bunks({ bunks, up, still }: { bunks: readonly Bunk[]; up: boolean; still: boolean }) {
  return (
    <View style={s.bunks} pointerEvents="none">
      {bunks.map((bunk, i) => (
        <BunkRow key={i} bunk={bunk} up={up} index={i} still={still} />
      ))}
    </View>
  );
}

function BunkRow({ bunk, up, index, still }: { bunk: Bunk; up: boolean; index: number; still: boolean }) {
  const t = useTheme();
  const lift = useSharedValue(0);
  const look = useSharedValue(0);
  const lid = useSharedValue(bunk.awake ? 1 : SHUT);
  const [blinkEvery] = useState(() => between(BLINK_EVERY_MS, Math.random()));

  useEffect(() => {
    if (still) {
      lift.value = up ? LIFT : 0;
      look.value = up ? LOOK_LEFT : 0;
      return;
    }
    const delay = index * STAGGER_MS;
    lift.value = withDelay(delay, up ? withTiming(LIFT, { duration: 120 }) : withSpring(0, DROP));
    look.value = withDelay(delay, withTiming(up ? LOOK_LEFT : 0, { duration: 160 }));
  }, [up, still, index, lift, look]);

  // Held, everyone is awake; otherwise open and blinking while it works, shut while it sleeps.
  useEffect(() => {
    cancelAnimation(lid);
    const open = up || bunk.awake;
    if (still || up || !open) {
      lid.value = still ? (open ? 1 : SHUT) : withTiming(open ? 1 : SHUT, { duration: 120 });
      return;
    }
    const blink = withSequence(withDelay(blinkEvery, withTiming(0.15, { duration: 60 })), withTiming(1, { duration: 80 }));
    lid.value = withSequence(withTiming(1, { duration: 120 }), withRepeat(blink, -1, false));
  }, [up, still, bunk.awake, blinkEvery, lid]);

  const bunkStyle = useAnimatedStyle(() => ({ transform: [{ translateY: lift.value }] }));
  const eyesStyle = useAnimatedStyle(() => ({ transform: [{ translateX: look.value }] }));
  const eyeStyle = useAnimatedStyle(() => ({ transform: [{ scaleY: lid.value }] }));
  const red = bunk.ink === 'red';

  return (
    <Animated.View style={[s.bunk, bunkStyle]}>
      <View style={[s.shadow, { backgroundColor: red ? t.secondary : t.primary }]} />
      <View style={[s.bar, { backgroundColor: red ? t.primary : t.secondary }]}>
        <Animated.View style={[s.eyes, eyesStyle]}>
          <Animated.View style={[s.eye, { backgroundColor: t.onPrimary }, eyeStyle]} />
          <Animated.View style={[s.eye, { backgroundColor: t.onPrimary }, eyeStyle]} />
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  // 1 above as well as the shadow's 1 below, so the bars' middle is the box's.
  bunks: { width: W + 1, gap: 2, paddingTop: 1 },
  bunk: { width: W + 1, height: H + 1 },
  shadow: { position: 'absolute', left: 1, top: 1, width: W, height: H },
  bar: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: W,
    height: H,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingRight: 3,
  },
  eyes: { flexDirection: 'row', gap: 2 },
  eye: { width: EYE, height: EYE },
});
