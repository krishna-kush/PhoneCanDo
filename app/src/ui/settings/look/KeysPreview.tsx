import { useEffect } from 'react';
import { Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useScheme } from '../../common/globals';
import { useReduceMotion } from '../../common/useReduceMotion';
import { EXTRA_KEYS } from '../../terminal/ExtraKeysBar';
import { termLook } from '../../terminal/theme/palette';
import { rowDrop } from './copy';

// The preview's parts, in dp: its height, the keyboard's and the keys row's.
const HEIGHT = 128;
const KEYBOARD_H = 58;
const ROW_H = 17;
// The keyboard's trip down or up, and how long it stays each way.
const TRIP_MS = 420;
const STAY_MS = 1500;
const ARROWS = { up: '↑', down: '↓', left: '←', right: '→' } as const;
// A keyboard's three rows of keys, as short stubs.
const BOARD = [10, 9, 7];

// The extra keys choice, shown: a little terminal in the terminal's own
// colours, its keyboard going down and coming back up over and over. With
// the keyboard, the keys row rides out with it; always up, the row stops
// at the screen's foot and stays. With reduce motion, or out of sight, the
// keyboard rests down, where the two differ.
export default function KeysPreview({ sticky, still }: { sticky: boolean; still: boolean }) {
  const look = termLook(useScheme());
  const reduce = useReduceMotion();
  const down = useSharedValue(1);
  const cursor = useSharedValue(1);

  useEffect(() => {
    if (reduce || still) {
      down.value = 1;
      cursor.value = 1;
      return;
    }
    const ease = Easing.inOut(Easing.cubic);
    down.value = 0;
    down.value = withRepeat(
      withSequence(
        withDelay(STAY_MS, withTiming(1, { duration: TRIP_MS, easing: ease })),
        withDelay(STAY_MS, withTiming(0, { duration: TRIP_MS, easing: ease })),
      ),
      -1,
    );
    cursor.value = withRepeat(withSequence(withDelay(500, withTiming(0, { duration: 0 })), withDelay(500, withTiming(1, { duration: 0 }))), -1);
  }, [reduce, still, down, cursor]);

  const board = useAnimatedStyle(() => ({ transform: [{ translateY: down.value * KEYBOARD_H }] }));
  const row = useAnimatedStyle(() => ({ transform: [{ translateY: rowDrop(down.value, sticky, KEYBOARD_H, ROW_H) }] }), [sticky]);
  const blink = useAnimatedStyle(() => ({ opacity: cursor.value }));
  const mono = { fontFamily: 'GeistMono-Regular', fontSize: 9 } as const;

  return (
    <View
      style={{ height: HEIGHT, overflow: 'hidden', borderWidth: 1, borderColor: look.line, backgroundColor: look.xterm.background }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View style={{ padding: 8, gap: 3 }}>
        <Text style={[mono, { color: look.xterm.foreground }]}>$ claude</Text>
        <Text style={[mono, { color: look.muted }]}>reading the logs…</Text>
        <Animated.View style={[{ width: 6, height: 10, backgroundColor: look.xterm.cursor }, blink]} />
      </View>
      <Animated.View
        style={[
          {
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: KEYBOARD_H,
            height: ROW_H,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 3,
            paddingHorizontal: 4,
            overflow: 'hidden',
            borderTopWidth: 1,
            borderColor: look.line,
            backgroundColor: look.panel,
          },
          row,
        ]}
      >
        {EXTRA_KEYS.map((k) => (
          <View key={k.label} style={{ paddingHorizontal: 3, paddingVertical: 1, backgroundColor: look.key }}>
            <Text style={[mono, { fontSize: 7, color: look.keyText }]}>{k.icon ? ARROWS[k.icon] : k.label}</Text>
          </View>
        ))}
      </Animated.View>
      <Animated.View
        style={[
          {
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: KEYBOARD_H,
            justifyContent: 'center',
            gap: 4,
            paddingHorizontal: 6,
            borderTopWidth: 1,
            borderColor: look.line,
            backgroundColor: look.panel,
          },
          board,
        ]}
      >
        {BOARD.map((n) => (
          <View key={n} style={{ flexDirection: 'row', justifyContent: 'center', gap: 3 }}>
            {Array.from({ length: n }, (_, i) => (
              <View key={i} style={{ flex: 1, maxWidth: 22, height: 12, backgroundColor: look.key, borderWidth: 1, borderColor: look.line }} />
            ))}
          </View>
        ))}
      </Animated.View>
    </View>
  );
}
