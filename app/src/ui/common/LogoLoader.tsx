import { useEffect } from 'react';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import logo from '../../../../theme/logo.json';
import { usePageActive } from '../nav/pageActive';
import { useTheme } from './globals';
import LogoMark, { logoOffset } from './LogoMark';
import { useReduceMotion } from './useReduceMotion';

const { loader, shadow } = logo;
const POSES = loader.poses;
const HOLD = loader.holdMs;
const END_HOLD = loader.endHoldMs;
const MORPH = loader.morphMs;
const [X1, Y1, X2, Y2] = loader.ease;
const EASE = Easing.bezier(X1, Y1, X2, Y2);
const [SX1, SY1, SX2, SY2] = loader.swapEase;
const SWAP_EASE = Easing.bezier(SX1, SY1, SX2, SY2);
const INPUT = POSES.map((_, i) => i);
const MAX = Math.max(...POSES.map((p) => Math.max(p.w, p.h)));
const START_SWAP = POSES[0].swap ? 1 : 0;
const LAST = POSES.length - 1;

// Logo-derived loading mark. The spec lives in theme/logo.json; the web reads
// the same file through web/src/lib/logoLoaderCss.ts. The red and amber layers
// physically trade places: amber rises from the shadow into the front while
// red recedes into the shadow; they trade inks where they exactly overlap.
// Reanimated on the UI thread, by transform only (each ink is a square of
// `size`, scaled to the pose and moved into place), so a frame never needs JS
// or a layout pass; it holds still while its page is not in front.
export default function LogoLoader({ size = 22 }: { size?: number }) {
  const t = useTheme();
  const reduce = useReduceMotion();
  const active = usePageActive();
  const progress = useSharedValue(0);
  const role = useSharedValue(START_SWAP);
  const still = reduce || !active;

  useEffect(() => {
    if (still) return;
    progress.value = 0;
    role.value = START_SWAP;
    // Shape and colour run as two clocks of the same length: the shape keeps
    // its snappy ease, while the swap uses the symmetric ease that lets the
    // stack flip exactly where the two squares coincide. The last pose
    // equals pose 0, so each loop restarts from 0 with no visible jump.
    const shape = [];
    const swap = [];
    for (let i = 1; i <= LAST; i++) {
      shape.push(withDelay(HOLD, withTiming(i, { duration: MORPH, easing: EASE })));
      // Share the shape's fast ease when both move, so the stack flips while
      // the shape is halfway instead of after it has visually settled.
      const morphs = POSES[i].w !== POSES[i - 1].w || POSES[i].h !== POSES[i - 1].h;
      swap.push(
        withDelay(HOLD, withTiming(POSES[i].swap ? 1 : 0, { duration: MORPH, easing: morphs ? EASE : SWAP_EASE })),
      );
    }
    // The square pause at the loop seam.
    shape.push(withDelay(HOLD + END_HOLD, withTiming(LAST, { duration: 0 })));
    swap.push(withDelay(HOLD + END_HOLD, withTiming(POSES[LAST].swap ? 1 : 0, { duration: 0 })));
    progress.value = withRepeat(withSequence(...shape), -1, false);
    role.value = withRepeat(withSequence(...swap), -1, false);
    return () => {
      cancelAnimation(progress);
      cancelAnimation(role);
    };
  }, [still, progress, role]);

  const off = logoOffset(size);
  const offsets = POSES.map((p) => off + (p.w > 1 || p.h > 1 ? shadow.stretchPx : 0));
  const widths = POSES.map((p) => size * p.w);
  const heights = POSES.map((p) => size * p.h);
  const box = size * MAX + off + shadow.stretchPx;
  const lefts = widths.map((w, i) => (box - w - offsets[i]) / 2);
  const tops = heights.map((h, i) => (box - h - offsets[i]) / 2);

  // One ink: `back` the layer behind. The front one sits at the smaller
  // offset; at role 0.5 both coincide, which is where the inks swap.
  const ink = (back: boolean) => {
    'worklet';
    const p = progress.value;
    const r = role.value;
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
  const behind = useAnimatedStyle(() => ink(true), [size, t.primary, t.secondary]);
  const front = useAnimatedStyle(() => ink(false), [size, t.primary, t.secondary]);

  if (reduce) return <LogoMark size={size} />;

  const square = { position: 'absolute' as const, left: 0, top: 0, width: size, height: size };
  return (
    <Animated.View style={{ width: box, height: box }} accessibilityRole="progressbar" accessibilityLabel="Loading">
      <Animated.View style={[square, behind]} />
      <Animated.View style={[square, front]} />
    </Animated.View>
  );
}
