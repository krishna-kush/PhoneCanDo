import { useCallback, useEffect } from 'react';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useDerivedValue,
  useFrameCallback,
  useSharedValue,
  type FrameInfo,
} from 'react-native-reanimated';
import logo from '../../../../theme/logo.json';
import { usePageActive } from '../nav/pageActive';
import { useTheme } from './globals';
import { loaderAt, loaderLoopMs, type LoaderTimes } from './loaderTimeline';
import LogoMark, { logoOffset } from './LogoMark';
import { useReduceMotion } from './useReduceMotion';

const { loader, shadow } = logo;
const POSES = loader.poses;
const [X1, Y1, X2, Y2] = loader.ease;
const EASE = Easing.bezierFn(X1, Y1, X2, Y2);
const [SX1, SY1, SX2, SY2] = loader.swapEase;
const SWAP_EASE = Easing.bezierFn(SX1, SY1, SX2, SY2);
const TIMES: LoaderTimes = { holdMs: loader.holdMs, morphMs: loader.morphMs, endHoldMs: loader.endHoldMs };
const LOOP = loaderLoopMs(POSES.length, TIMES);
const INPUT = POSES.map((_, i) => i);
const MAX = Math.max(...POSES.map((p) => Math.max(p.w, p.h)));

// Logo-derived loading mark. The spec lives in theme/logo.json; the web reads
// the same file through web/src/lib/logoLoaderCss.ts. The red and amber layers
// physically trade places: amber rises from the shadow into the front while
// red recedes into the shadow; they trade inks where they exactly overlap.
// Reanimated on the UI thread, by transform only (each ink is a square of
// `size`, scaled to the pose and moved into place), so a frame never needs JS
// or a layout pass; it holds still while its page is not in front. One
// clock (a frame callback) runs the loop, and loaderTimeline.ts turns its
// time into the pose, as the web's keyframes do.
export default function LogoLoader({ size = 22 }: { size?: number }) {
  const t = useTheme();
  const reduce = useReduceMotion();
  const active = usePageActive();
  const still = reduce || !active;

  // Milliseconds into the loop, advanced each frame while it runs.
  const clock = useSharedValue(0);
  const tick = useCallback(
    (f: FrameInfo) => {
      'worklet';
      clock.value = (clock.value + (f.timeSincePreviousFrame ?? 0)) % LOOP;
    },
    [clock],
  );
  const frames = useFrameCallback(tick, false);
  useEffect(() => {
    if (still) return;
    clock.value = 0;
    frames.setActive(true);
    return () => frames.setActive(false);
  }, [still, clock, frames]);
  const phase = useDerivedValue(() => loaderAt(clock.value, POSES, TIMES, EASE, SWAP_EASE));

  const off = logoOffset(size);
  const offsets = POSES.map((p) => off + (p.w > 1 || p.h > 1 ? shadow.stretchPx : 0));
  const widths = POSES.map((p) => size * p.w);
  const heights = POSES.map((p) => size * p.h);
  const box = size * MAX + off + shadow.stretchPx;
  const lefts = widths.map((w, i) => (box - w - offsets[i]) / 2);
  const tops = heights.map((h, i) => (box - h - offsets[i]) / 2);

  // One ink: `back` the layer behind, at shape progress `p` and swap role
  // `r`. The front one sits at the smaller offset; at role 0.5 both
  // coincide, which is where the inks swap.
  const ink = (back: boolean, p: number, r: number) => {
    'worklet';
    const w = interpolate(p, INPUT, widths);
    const h = interpolate(p, INPUT, heights);
    const shift = interpolate(p, INPUT, offsets) * (back ? Math.max(r, 1 - r) : Math.min(r, 1 - r));
    const left = interpolate(p, INPUT, lefts) + shift;
    const top = interpolate(p, INPUT, tops) + shift;
    const redInFront = r < 0.5;
    return {
      backgroundColor: back === redInFront ? t.secondary : t.primary,
      transform: [
        { translateX: left - size / 2 + w / 2 },
        { translateY: top - size / 2 + h / 2 },
        { scaleX: w / size },
        { scaleY: h / size },
      ],
    };
  };
  // Each style reads the phase itself: Reanimated re-runs a style only for
  // the shared values its own worklet captures, never ones read inside a
  // helper it calls (a style that left them to `ink` stood still between
  // re-renders and jumped pose to pose).
  const behind = useAnimatedStyle(() => ink(true, phase.value.shape, phase.value.role), [size, t.primary, t.secondary]);
  const front = useAnimatedStyle(() => ink(false, phase.value.shape, phase.value.role), [size, t.primary, t.secondary]);

  if (reduce) return <LogoMark size={size} />;

  const square = { position: 'absolute' as const, left: 0, top: 0, width: size, height: size };
  return (
    <Animated.View style={{ width: box, height: box }} accessibilityRole="progressbar" accessibilityLabel="Loading">
      <Animated.View style={[square, behind]} />
      <Animated.View style={[square, front]} />
    </Animated.View>
  );
}
