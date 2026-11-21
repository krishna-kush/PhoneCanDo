import { View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../../globals';
import { drawBars } from '../barcode/draw';
import { EVEN_EASE, type MarkProps, useMarkProgress } from './progress';

const W = 44;
const H = 18;
// The laser reaches a little past the bars, top and bottom.
const BEAM_OVER = 3;
const BEAM = 1.5;

// "ON" and "OFF" as Code 128 runs, from the site's encoder (the way
// app/scripts/make-barcodes.mjs makes the key strips'): whoever scans the
// switch reads what it is.
const ON_BARS = drawBars('2112141331211133211321132331112');
const OFF_BARS = drawBars('2112141331211323111323112321212331112');

// A barcode label read by a scanner: turned on, a red laser line sweeps
// left to right and the label behind it reprints as "ON" in red; turned
// off, it sweeps back and leaves "OFF" in faint ink. Its pace is even, as
// a scanner's.
export default function Scan({ on, instant = false }: MarkProps) {
  const t = useTheme();
  const p = useMarkProgress(on, instant, { inMs: 420, inEase: EVEN_EASE, outMs: 300, outEase: EVEN_EASE });
  const inked = useAnimatedStyle(() => ({ width: W * p.value }));
  const blank = useAnimatedStyle(() => ({ width: W * (1 - p.value) }));
  // Only lit while it moves: gone at either end.
  const beam = useAnimatedStyle(() => ({
    opacity: Math.sin(Math.PI * p.value),
    transform: [{ translateX: W * p.value - BEAM / 2 }],
  }));
  return (
    <View
      style={{ width: W, height: H, flexShrink: 0 }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
    >
      <Animated.View style={[{ position: 'absolute', left: 0, top: 0, bottom: 0, overflow: 'hidden' }, inked]}>
        <Bars bars={ON_BARS} ink={t.primary} />
      </Animated.View>
      <Animated.View style={[{ position: 'absolute', right: 0, top: 0, bottom: 0, overflow: 'hidden' }, blank]}>
        <View style={{ position: 'absolute', right: 0, top: 0 }}>
          <Bars bars={OFF_BARS} ink={t.faint} />
        </View>
      </Animated.View>
      <Animated.View
        style={[{ position: 'absolute', left: 0, top: -BEAM_OVER, width: BEAM, height: H + 2 * BEAM_OVER, backgroundColor: t.primaryHi }, beam]}
      />
    </View>
  );
}

// drawBars' quiet zone, ten modules each side.
const QUIET = 10;

// One label's bars stretched over the whole width, its quiet zones cut
// off: the switch's own edges stand in for them.
function Bars({ bars, ink }: { bars: { width: number; path: string }; ink: string }) {
  return (
    <Svg width={W} height={H} viewBox={`${QUIET} 0 ${bars.width - 2 * QUIET} 1`} preserveAspectRatio="none">
      <Path d={bars.path} fill={ink} />
    </Svg>
  );
}
