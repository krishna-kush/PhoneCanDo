import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing } from 'react-native';
import logo from '../../../../theme/logo.json';
import { useTheme } from './globals';
import LogoMark, { logoOffset } from './LogoMark';

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

// Logo-derived loading mark. The spec lives in theme/logo.json; the web reads
// the same file through web/src/lib/logoLoaderCss.ts. The red and amber layers
// physically trade places: amber rises from the shadow into the front while
// red recedes into the shadow; the stack flips where they exactly overlap.
// Core Animated because width, height and position animate on the JS driver.
export default function LogoLoader({ size = 22 }: { size?: number }) {
  const t = useTheme();
  const progress = useRef(new Animated.Value(0)).current;
  const role = useRef(new Animated.Value(START_SWAP)).current;
  const [reduce, setReduce] = useState(false);

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled().then((on) => {
      if (alive) setReduce(on);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);

  useEffect(() => {
    if (reduce) return;
    progress.setValue(0);
    role.setValue(START_SWAP);
    // Shape and colour run as two parallel clocks: the shape keeps its snappy
    // ease, while the layer swap uses the symmetric ease that lets the stack
    // flip exactly where the two squares coincide.
    const shapeSteps: Animated.CompositeAnimation[] = [
      // The last pose equals pose 0, so this zero-time reset is invisible but
      // makes every loop start the same 0 -> 1 direction as the first one.
      Animated.timing(progress, { toValue: 0, duration: 0, useNativeDriver: false }),
      Animated.delay(HOLD),
    ];
    const swapSteps: Animated.CompositeAnimation[] = [
      Animated.timing(role, {
        toValue: START_SWAP,
        duration: 0,
        useNativeDriver: false,
      }),
      Animated.delay(HOLD),
    ];
    for (let i = 1; i < POSES.length; i++) {
      shapeSteps.push(
        Animated.timing(progress, {
          toValue: i,
          duration: MORPH,
          easing: EASE,
          useNativeDriver: false,
        })
      );
      // Share the shape's fast ease when both move, so the stack flips while
      // the shape is halfway instead of after it has visually settled.
      const morphs = POSES[i].w !== POSES[i - 1].w || POSES[i].h !== POSES[i - 1].h;
      swapSteps.push(
        Animated.timing(role, {
          toValue: POSES[i].swap ? 1 : 0,
          duration: MORPH,
          easing: morphs ? EASE : SWAP_EASE,
          useNativeDriver: false,
        })
      );
      shapeSteps.push(Animated.delay(HOLD));
      swapSteps.push(Animated.delay(HOLD));
    }
    // The last pose equals pose 0, so this also lengthens the square pause at
    // the loop seam.
    shapeSteps.push(Animated.delay(END_HOLD));
    swapSteps.push(Animated.delay(END_HOLD));
    // The last pose is pose 0; resetting would flash a frame at the seam.
    const loop = Animated.loop(
      Animated.parallel([Animated.sequence(shapeSteps), Animated.sequence(swapSteps)]),
      { resetBeforeIteration: false }
    );
    loop.start();
    return () => loop.stop();
  }, [progress, role, reduce]);

  if (reduce) return <LogoMark size={size} />;

  const off = logoOffset(size);
  const offsets = POSES.map((p) => off + (p.w > 1 || p.h > 1 ? shadow.stretchPx : 0));
  const widths = POSES.map((p) => size * p.w);
  const heights = POSES.map((p) => size * p.h);
  const box = size * MAX + off + shadow.stretchPx;
  const width = progress.interpolate({ inputRange: INPUT, outputRange: widths });
  const height = progress.interpolate({ inputRange: INPUT, outputRange: heights });
  const shadowOffset = progress.interpolate({ inputRange: INPUT, outputRange: offsets });
  const frontLeft = progress.interpolate({
    inputRange: INPUT,
    outputRange: widths.map((w, i) => (box - w - offsets[i]) / 2),
  });
  const frontTop = progress.interpolate({
    inputRange: INPUT,
    outputRange: heights.map((h, i) => (box - h - offsets[i]) / 2),
  });
  const redLeft = Animated.add(frontLeft, Animated.multiply(shadowOffset, role));
  const redTop = Animated.add(frontTop, Animated.multiply(shadowOffset, role));
  const rest = Animated.subtract(1, role);
  const yellowLeft = Animated.add(frontLeft, Animated.multiply(shadowOffset, rest));
  const yellowTop = Animated.add(frontTop, Animated.multiply(shadowOffset, rest));
  // The layers are coincident at role 0.5, so this step is invisible.
  const redZ = role.interpolate({
    inputRange: [0, 0.5, 0.5001, 1],
    outputRange: [1, 1, 0, 0],
    extrapolate: 'clamp',
  });
  const yellowZ = role.interpolate({
    inputRange: [0, 0.4999, 0.5, 1],
    outputRange: [0, 0, 1, 1],
    extrapolate: 'clamp',
  });

  return (
    <Animated.View
      style={{ width: box, height: box }}
      accessibilityRole="progressbar"
      accessibilityLabel="Loading"
    >
      <Animated.View
        style={{
          position: 'absolute',
          left: redLeft,
          top: redTop,
          width,
          height,
          backgroundColor: t.primary,
          zIndex: redZ,
        }}
      />
      <Animated.View
        style={{
          position: 'absolute',
          left: yellowLeft,
          top: yellowTop,
          width,
          height,
          backgroundColor: t.secondary,
          zIndex: yellowZ,
        }}
      />
    </Animated.View>
  );
}
