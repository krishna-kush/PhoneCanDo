import { useEffect, useMemo, useState } from 'react';
import { Keyboard, StyleSheet, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector, Pressable } from 'react-native-gesture-handler';
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useAgentsStore } from '../../state/agents';
import { useAppStore } from '../../state/app';
import { useLinuxStore } from '../../state/linux';
import { useModelsStore } from '../../state/models';
import { useTheme } from '../common/globals';
import { CANCEL_MS } from '../nav/motion';
import { drawerPull } from '../nav/progress';
import DrawerContent from './DrawerContent';

const OPEN_MS = 300;
const CLOSE_MS = 220;
/** How far the back gesture pulls the drawer in before it commits. */
const PULL = 0.2;
const EMPHASIZED = Easing.bezier(0.05, 0.7, 0.1, 1);
const STANDARD = Easing.bezier(0.2, 0, 0, 1);

function refresh() {
  useAgentsStore.getState().refreshAgents();
  useLinuxStore.getState().refreshLinux();
  useModelsStore.getState().refreshModels();
}

// The side drawer over Home, from the left: the header's agent chip opens
// it; the scrim, a swipe to the left or Back (which pulls it in under the
// thumb first, nav/backWorklet.ts) closes it. The swipe follows the finger
// on the UI thread (react-native-gesture-handler), so a busy JS thread
// never holds it back. Not from the screen's left edge: on gesture
// navigation that edge is Back. Its content mounts on the first open and
// stays (later opens only slide), with the faces still while it is shut.
// Once open it re-reads the agents, envs and models, which move while it
// is away: after the slide, so the reads never cost it a frame. Its slide
// starts the moment the store says open or shut, not after a render: a
// page picked here is built in the render that closes it, and the drawer
// must not sit open until that page is ready. Its faces hold still once it
// has slid shut, so that render never redraws the drawer's content.
export default function AppDrawer() {
  const t = useTheme();
  const { width } = useWindowDimensions();
  const panelW = Math.min(Math.round(width * 0.86), 360);
  const open = useAppStore((s) => s.drawerOpen);
  const setDrawerOpen = useAppStore((s) => s.setDrawerOpen);
  const shown = useSharedValue(0);
  const [mounted, setMounted] = useState(open);
  // Its faces move while it is on screen: from the open until the slide shut ends.
  const [awake, setAwake] = useState(open);

  useEffect(() => {
    const slideOpen = () => {
      shown.value = withTiming(1, { duration: OPEN_MS, easing: EMPHASIZED }, (finished) => {
        'worklet';
        if (finished) runOnJS(refresh)();
      });
    };
    const slideShut = () => {
      // Shut from wherever a drag or the back gesture left it.
      shown.value = shown.value * (1 - PULL * drawerPull.value);
      drawerPull.value = 0;
      shown.value = withTiming(0, { duration: CLOSE_MS, easing: STANDARD }, (finished) => {
        'worklet';
        if (finished) runOnJS(setAwake)(false);
      });
    };
    if (useAppStore.getState().drawerOpen) slideOpen();
    return useAppStore.subscribe((s, prev) => {
      if (s.drawerOpen === prev.drawerOpen) return;
      if (!s.drawerOpen) {
        slideShut();
        return;
      }
      // A TUI home keeps the keyboard up for its hidden input.
      Keyboard.dismiss();
      // The content mounts on the first open and stays.
      setMounted(true);
      setAwake(true);
      slideOpen();
    });
  }, [shown]);

  const close = () => setDrawerOpen(false);
  // A swipe to the left: horizontal first, so the list still scrolls.
  const swipe = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX(-12)
        .failOffsetY([-12, 12])
        .onUpdate((e) => {
          shown.value = Math.min(1, Math.max(0, 1 + e.translationX / panelW));
        })
        .onEnd((e) => {
          if (e.translationX < -panelW * 0.3 || e.velocityX < -500) runOnJS(close)();
          else shown.value = withTiming(1, { duration: CANCEL_MS, easing: STANDARD });
        }),
    // close only calls the store's setter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [panelW, shown],
  );

  const panel = useAnimatedStyle(() => ({
    transform: [{ translateX: -panelW * (1 - shown.value * (1 - PULL * drawerPull.value)) }],
  }));
  const scrim = useAnimatedStyle(() => ({ opacity: 0.55 * shown.value * (1 - 0.5 * drawerPull.value) }));

  if (!mounted) return null;
  return (
    <Animated.View
      style={StyleSheet.absoluteFill}
      pointerEvents={open ? 'auto' : 'none'}
      importantForAccessibility={open ? 'auto' : 'no-hide-descendants'}
    >
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: '#000' }, scrim]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={close}
          accessibilityRole="button"
          accessibilityLabel="Close the menu"
        />
      </Animated.View>
      <GestureDetector gesture={swipe}>
        <Animated.View
          style={[
            {
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: panelW,
              backgroundColor: t.panel,
              borderRightWidth: 1,
              borderColor: t.lineStrong,
            },
            panel,
          ]}
          accessibilityViewIsModal
        >
          <DrawerContent still={!awake} />
        </Animated.View>
      </GestureDetector>
    </Animated.View>
  );
}
