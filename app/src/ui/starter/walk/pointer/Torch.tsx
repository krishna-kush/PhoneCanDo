import { PixelRatio } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { useTheme } from '../../../common/globals';
import type { PointerProps } from './pointerProps';
import type { FrameMotion } from './useFrameMotion';

/** The hole's room around the frame at rest, and how much wider it starts. */
const PAD = 8;
const OPEN = 60;
/** Device pixels per point, so the panels' edges meet on whole pixels. */
const RATIO = PixelRatio.get();

type Side = 'top' | 'bottom' | 'left' | 'right';

// The spotlight's dark (Spotlight.tsx): the screen dims but for a hole
// around the thing to tap that breathes with the ticks. The hole opens
// wide and closes in on the spot, then slides to the next one. The dark
// takes no taps: the app under it works as ever.
//
// Four panels round the hole, each the guide's full size and moved (the
// sides also stretched) by transforms alone: a transform or an opacity
// never lays the screen out again, so breathing costs no layout per frame.
export default function Torch({ motion, size }: PointerProps) {
  const t = useTheme();
  return (
    <>
      {(['top', 'bottom', 'left', 'right'] as const).map((side) => (
        <Dark key={side} side={side} motion={motion} size={size} color={t.scrimSoft} />
      ))}
    </>
  );
}

function Dark({ side, motion, size, color }: { side: Side; motion: FrameMotion; size: { width: number; height: number }; color: string }) {
  const W = size.width;
  const H = size.height;
  const style = useAnimatedStyle(() => {
    const px = (v: number) => Math.round(v * RATIO) / RATIO;
    const pad = PAD + (1 - Math.min(1, motion.on.value)) * OPEN + motion.breath.value * 3;
    const left = px(motion.x.value - pad);
    const top = px(motion.y.value - pad);
    const right = px(motion.x.value + motion.width.value + pad);
    const bottom = px(motion.y.value + motion.height.value + pad);
    const opacity = Math.min(1, Math.max(0, motion.on.value));
    // Above the hole: a full panel whose foot sits at its top; below: one whose top sits at its foot.
    if (side === 'top') return { opacity, transform: [{ translateY: Math.max(0, top) - H }] };
    if (side === 'bottom') return { opacity, transform: [{ translateY: bottom }] };
    // Beside it: a one-point strip stretched about its middle to the hole's height.
    const tall = Math.max(0, bottom - top);
    const across = side === 'left' ? left - W : right;
    return { opacity, transform: [{ translateX: across }, { translateY: (top + bottom) / 2 - 0.5 }, { scaleY: tall }] };
  });
  const sideways = side === 'left' || side === 'right';
  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: 'absolute', left: 0, top: 0, width: W, height: sideways ? 1 : H, backgroundColor: color }, style]}
    />
  );
}
