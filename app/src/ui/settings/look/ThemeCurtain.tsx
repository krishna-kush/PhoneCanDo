import { useEffect } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import tokens from '../../../../../theme/tokens.json';
import AgentFace from '../../common/face/AgentFace';
import { SWEEP, sweepHold } from './copy';
import { useThemeSweep } from './themeSweep';

// A theme change, played over the whole app (mounted once in App.tsx): a
// circle of the new theme's background opens from the screen that was
// tapped, like a light coming on (or going off), with A-01 popping up in
// the middle to react: lights on, it wakes from a nap, z and all,
// squints against the glare and blinks its eyes open; lights off, it
// dozes off as any face does (its lids droop, a heavy blink, they drag
// back up and drift shut, its head nodding), its z rising as they meet,
// for a beat. Each runs on the UI thread from its
// first frame (AgentFace's reaction), so the re-render can't stall it.
// Once the colour covers the app the theme goes in under it
// (themeSweep.ts), so the slow whole-app re-render happens out of sight;
// the colour fades away two frames after it, and not before A-01's beat
// is done (sweepHold). Takes no touches.
export default function ThemeCurtain() {
  const sweep = useThemeSweep((s) => s.sweep);
  const { width, height } = useWindowDimensions();
  const grow = useSharedValue(0);
  const fade = useSharedValue(1);

  useEffect(() => {
    useThemeSweep.getState().setCurtain(true);
    return () => useThemeSweep.getState().setCurtain(false);
  }, []);

  useEffect(() => {
    if (!sweep) return;
    const { id } = sweep;
    const { apply, done } = useThemeSweep.getState();
    const start = Date.now();
    let wait: ReturnType<typeof setTimeout> | undefined;
    const fadeOut = () => {
      fade.value = withTiming(0, { duration: SWEEP.fadeMs, easing: Easing.in(Easing.quad) }, (finished) => {
        if (finished) scheduleOnRN(done, id);
      });
    };
    // The theme goes in, then the colour lifts once the re-render has drawn and A-01 is done.
    const covered = () => {
      apply(id);
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          wait = setTimeout(fadeOut, Math.max(0, sweepHold(sweep.scheme) - (Date.now() - start)));
        }),
      );
    };
    grow.value = 0;
    fade.value = 1;
    grow.value = withTiming(1, { duration: SWEEP.growMs, easing: Easing.out(Easing.cubic) }, (finished) => {
      if (finished) scheduleOnRN(covered);
    });
    return () => clearTimeout(wait);
  }, [sweep, grow, fade]);

  const cover = useAnimatedStyle(() => ({ opacity: fade.value, transform: [{ scale: grow.value }] }));
  const face = useAnimatedStyle(() => ({ opacity: grow.value * fade.value, transform: [{ scale: 0.4 + 0.6 * grow.value }] }));

  if (!sweep) return null;
  const ink = tokens[sweep.scheme];
  // Wide enough from the tap to reach the farthest corner.
  const r = Math.hypot(Math.max(sweep.x, width - sweep.x), Math.max(sweep.y, height - sweep.y));
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Animated.View
        style={[
          { position: 'absolute', left: sweep.x - r, top: sweep.y - r, width: 2 * r, height: 2 * r, borderRadius: r, backgroundColor: ink.bg },
          cover,
        ]}
      />
      <Animated.View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', gap: 14 }, face]}>
        {sweep.scheme === 'light' ? (
          <AgentFace mood="awake" reaction="glare" size={44} />
        ) : (
          <AgentFace mood="asleep" reaction="doze" size={44} />
        )}
        <Text style={{ fontFamily: 'GeistMono-Regular', fontSize: 11, letterSpacing: 1.6, color: ink.secondaryInk }}>
          {sweep.scheme === 'light' ? 'LIGHTS ON' : 'LIGHTS OFF'}
        </Text>
      </Animated.View>
    </View>
  );
}
