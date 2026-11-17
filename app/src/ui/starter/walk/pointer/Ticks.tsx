import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { useTheme } from '../../../common/globals';
import PlainText from '../../../common/PlainText';
import type { PointerProps } from './pointerProps';
import type { FrameMotion } from './useFrameMotion';

/** The ticks' distance from the frame at rest, how far out they fly in from, an arm's length and its ink. */
const PAD = 6;
const FLY = 36;
const ARM = 15;
const INK = 3;
/** The tag's height, to sit it above the top left tick. */
const TAG_H = 20;

// The spotlight's figure (Spotlight.tsx): four amber registration ticks fly in
// and snap around the thing to tap, breathing slowly while they wait, with
// a FIG label held still on the top left one (under it when the spot is at
// the top of the screen). From one tap to the next they glide across.
export default function Ticks({ motion, frame, room, hop }: PointerProps) {
  const t = useTheme();
  const tagBelow = frame != null && frame.y - PAD - TAG_H < room.top;
  return (
    <>
      <Tick motion={motion} right={false} bottom={false} color={t.secondary} />
      <Tick motion={motion} right bottom={false} color={t.secondary} />
      <Tick motion={motion} right={false} bottom color={t.secondary} />
      <Tick motion={motion} right bottom color={t.secondary} />
      <Tag motion={motion} below={tagBelow} label={`fig ${hop} · tap`} color={t.secondary} />
    </>
  );
}

function Tick({ motion, right, bottom, color }: { motion: FrameMotion; right: boolean; bottom: boolean; color: string }) {
  const style = useAnimatedStyle(() => {
    const pad = PAD + (1 - motion.on.value) * FLY + motion.breath.value * 3;
    const left = right ? motion.x.value + motion.width.value + pad - ARM : motion.x.value - pad;
    const top = bottom ? motion.y.value + motion.height.value + pad - ARM : motion.y.value - pad;
    return { opacity: Math.min(1, Math.max(0, motion.on.value)), transform: [{ translateX: left }, { translateY: top }] };
  });
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          left: 0,
          top: 0,
          width: ARM,
          height: ARM,
          borderColor: color,
          borderTopWidth: bottom ? 0 : INK,
          borderBottomWidth: bottom ? INK : 0,
          borderLeftWidth: right ? 0 : INK,
          borderRightWidth: right ? INK : 0,
        },
        style,
      ]}
    />
  );
}

function Tag({ motion, below, label, color }: { motion: FrameMotion; below: boolean; label: string; color: string }) {
  const style = useAnimatedStyle(() => {
    const pad = PAD + (1 - motion.on.value) * FLY;
    const top = below ? motion.y.value + motion.height.value + pad + 4 : motion.y.value - pad - TAG_H - 4;
    return { opacity: Math.min(1, Math.max(0, motion.on.value)), transform: [{ translateX: motion.x.value - pad }, { translateY: top }] };
  });
  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: 'absolute', left: 0, top: 0, height: TAG_H, justifyContent: 'center', paddingHorizontal: 6, backgroundColor: color }, style]}
    >
      <PlainText fontFamily="mono" fontSize={10} fontWeight="600" letterSpacing={1.4} color="bg" textTransform="uppercase">
        {label}
      </PlainText>
    </Animated.View>
  );
}
