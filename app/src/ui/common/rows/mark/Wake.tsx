import { View } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle } from 'react-native-reanimated';
import { PLAIN } from '../../../../../../mascot/look.ts';
import tokens from '../../../../../../theme/tokens.json';
import { monoFace } from '../../../../../tamagui.config';
import { faceLayout } from '../../face/layout';
import { LID, LOOK, pupilStyle } from '../../face/motion';
import { useTheme } from '../../globals';
import { type MarkProps, stage, useMarkProgress } from './progress';

const SIZE = 22;
const LINE = 1.5;
// A-01's own figure (the face's layout), drawn here with motion of our own:
// the face's wake-up is slow and its jolt pops the eyes past open.
const F = faceLayout(PLAIN, SIZE);
const FRONT = F.fig.front;
const BACK = { left: F.fig.back.x + F.dx, top: F.fig.back.y + F.dy };
// Where the shadow block hides: right behind the front one.
const TUCK = { x: F.left - BACK.left, y: F.top - BACK.top };
// Shut eyes as a line still thick enough to see.
const SHUT = Math.max(LID.asleep, LINE / F.eyeH);
const PUPIL = F.pupil ? { ...F.pupil, ...pupilStyle(LOOK.awake, F.eyeW) } : null;

// A-01 clocking in. Off, it is drawn in pencil and asleep: a grey outline,
// its eyes shut lines under a "z". Turned on, it inks red, the "z" goes,
// its eyes open white and look over, and its amber shadow slides out from
// behind it, the logo whole; turned off, it all goes back.
export default function Wake({ on, instant = false }: MarkProps) {
  const t = useTheme();
  const p = useMarkProgress(on, instant, { inMs: 420, outMs: 240 });
  const frontInk = FRONT.ink === 'red' ? t.primary : t.secondary;
  const backInk = F.fig.back.ink === 'red' ? t.primary : t.secondary;
  const fill = useAnimatedStyle(() => ({ opacity: stage(p.value, 0, 0.5) }));
  const outline = useAnimatedStyle(() => ({ borderColor: interpolateColor(stage(p.value, 0, 0.5), [0, 1], [t.lineStrong, frontInk]) }));
  const shadow = useAnimatedStyle(() => {
    const out = 1 - stage(p.value, 0.35, 1);
    return {
      opacity: stage(p.value, 0.35, 0.6),
      transform: [{ translateX: TUCK.x * out }, { translateY: TUCK.y * out }],
    };
  });
  const eye = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(stage(p.value, 0, 0.5), [0, 1], [t.dim, t.onPrimary]),
    transform: [{ scaleY: SHUT + (1 - SHUT) * stage(p.value, 0.3, 0.9) }],
  }));
  const pupil = useAnimatedStyle(() => ({ opacity: stage(p.value, 0.6, 0.9) }));
  const z = useAnimatedStyle(() => ({ opacity: 1 - stage(p.value, 0, 0.3) }));
  const eyeAt = (e: { x: number; y: number }) => (
    <Animated.View
      style={[{ position: 'absolute', left: e.x - FRONT.x, top: e.y - FRONT.y, width: F.eyeW, height: F.eyeH }, eye]}
    >
      {PUPIL ? (
        <Animated.View
          style={[
            {
              position: 'absolute',
              left: PUPIL.x - F.eyeA.x,
              top: PUPIL.y - F.eyeA.y,
              width: PUPIL.w,
              height: PUPIL.h,
              // Always dark, as the face's pupils are, on either theme.
              backgroundColor: tokens.dark.bg,
              transform: PUPIL.transform,
            },
            pupil,
          ]}
        />
      ) : null}
    </Animated.View>
  );
  return (
    <View
      style={{ width: F.box, height: F.box, flexShrink: 0 }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
    >
      <Animated.View
        style={[{ position: 'absolute', ...BACK, width: F.bodyW, height: F.bodyH, backgroundColor: backInk }, shadow]}
      />
      <View style={{ position: 'absolute', left: F.left, top: F.top, width: F.bodyW, height: F.bodyH }}>
        <Animated.View style={[{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, backgroundColor: frontInk }, fill]} />
        <Animated.View style={[{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, borderWidth: LINE }, outline]} />
        {eyeAt(F.eyeA)}
        {eyeAt(F.eyeB)}
      </View>
      <Animated.Text
        style={[{ position: 'absolute', right: 0, top: 0, fontFamily: monoFace[700].normal, fontSize: F.mark, color: t.dim }, z]}
      >
        z
      </Animated.Text>
    </View>
  );
}
