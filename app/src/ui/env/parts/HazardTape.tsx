import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, View } from 'react-native';
import Svg, { Defs, Path, Pattern, Rect } from 'react-native-svg';
import { useTheme } from '../../common/globals';
import { useReduceMotion } from '../../common/useReduceMotion';

const HEIGHT = 6;
/** One amber stripe and one gap, along the tape. */
const PERIOD = 12;

// Progress with no known total: a strip of amber hazard tape that crawls
// along, on the bar's own track. Still while animations are off.
export default function HazardTape() {
  const t = useTheme();
  const reduce = useReduceMotion();
  const [width, setWidth] = useState(0);
  const shift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    shift.setValue(0);
    if (reduce) return;
    const loop = Animated.loop(
      Animated.timing(shift, { toValue: 1, duration: 700, easing: Easing.linear, useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [reduce, shift]);

  return (
    <View
      style={{ height: HEIGHT, overflow: 'hidden', backgroundColor: t.line }}
      onLayout={(e) => setWidth(Math.round(e.nativeEvent.layout.width))}
      accessibilityRole="progressbar"
      accessibilityLabel="Working"
    >
      {width > 0 ? (
        <Animated.View
          style={{ transform: [{ translateX: shift.interpolate({ inputRange: [0, 1], outputRange: [-PERIOD, 0] }) }] }}
        >
          <Svg width={width + PERIOD} height={HEIGHT}>
            <Defs>
              <Pattern id="tape" width={PERIOD} height={HEIGHT} patternUnits="userSpaceOnUse">
                <Path d={`M0 ${HEIGHT} L${HEIGHT} 0 L${HEIGHT + PERIOD / 2} 0 L${PERIOD / 2} ${HEIGHT} Z`} fill={t.secondary} />
              </Pattern>
            </Defs>
            <Rect x={0} y={0} width={width + PERIOD} height={HEIGHT} fill="url(#tape)" />
          </Svg>
        </Animated.View>
      ) : null}
    </View>
  );
}
