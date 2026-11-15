import { useEffect, useState, type ReactNode } from 'react';
import { Modal, StyleSheet, useWindowDimensions } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { YStack } from 'tamagui';
import { useReduceMotion } from './useReduceMotion';

const OPEN_MS = 300;
const CLOSE_MS = 220;

type Props = {
  open: boolean;
  /** Back or a tap on the scrim. */
  onClose: () => void;
  /** What the scrim says to a screen reader. */
  closeLabel: string;
  /** The panel; mounted anew each time the sheet opens. */
  children: ReactNode;
};

// A sheet over everything (a modal, so it covers pages and the drawer
// alike): the panel slides up from the bottom while the scrim fades in,
// and slides back down before it unmounts. With "Remove animations" on it
// just appears and goes. Transform and opacity only, on the UI thread.
//
// The panel takes touches only once it has slid up (`settled`). Reanimated's
// fast path (ANDROID_SYNCHRONOUSLY_UPDATE_UI_PROPS) moves the native view
// but not React's copy of it, which a press measures: until a React commit
// it is still where the slide began, so a tap's first move fell outside and
// the press was dropped. Turning the touches on is that commit.
export default function BottomSheet({ open, onClose, closeLabel, children }: Props) {
  const { height } = useWindowDimensions();
  const reduce = useReduceMotion();
  const [mounted, setMounted] = useState(open);
  const [settled, setSettled] = useState(false);
  const shown = useSharedValue(0);
  // The panel's own height once laid out; until then the screen's, so it starts below the edge.
  const panel = useSharedValue(height);

  useEffect(() => {
    if (open) setMounted(true);
  }, [open]);

  useEffect(() => {
    if (!mounted) return;
    setSettled(false);
    const duration = reduce ? 0 : open ? OPEN_MS : CLOSE_MS;
    const easing = open ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic);
    shown.value = withTiming(open ? 1 : 0, { duration, easing }, (done) => {
      if (!done) return;
      if (open) scheduleOnRN(setSettled, true);
      else scheduleOnRN(setMounted, false);
    });
  }, [open, mounted, reduce, shown]);

  const scrim = useAnimatedStyle(() => ({ opacity: shown.value }));
  const slide = useAnimatedStyle(() => ({ transform: [{ translateY: (1 - shown.value) * panel.value }] }));

  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <YStack flex={1} justifyContent="flex-end">
        <Animated.View style={[StyleSheet.absoluteFill, scrim]}>
          <YStack flex={1} backgroundColor="sheet-overlay" onPress={onClose} accessibilityLabel={closeLabel} />
        </Animated.View>
        {/* box-only while sliding: a tap on the panel lands on it, not on the scrim behind. */}
        <Animated.View
          style={slide}
          pointerEvents={settled ? 'auto' : 'box-only'}
          onLayout={(e) => {
            panel.value = e.nativeEvent.layout.height;
          }}
        >
          {mounted ? children : null}
        </Animated.View>
      </YStack>
    </Modal>
  );
}
