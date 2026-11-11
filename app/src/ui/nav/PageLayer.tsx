import { memo, useMemo, type ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import type { Page } from '../../state/app/stack';
import { useTheme } from '../common/globals';
import LayerBody from './LayerBody';
import { layerStyle, roleOf, scrimOpacity } from './motion';
import PageView from './PageView';
import {
  belowKey,
  commitProgress,
  motionKind,
  movingKey,
  previewing,
  pullEdge,
  pullProgress,
  pushProgress,
  topKey,
  underKey,
} from './progress';

type Props = {
  /** The layer's key: its part comes from the stack's state by it (motion.ts roleOf). */
  layerKey: string;
  /** The page in it; null for Home. */
  page: Page | null;
  /** Home's UI (only Home's layer gets it). */
  home: ReactNode;
  width: number;
};

// One full-screen layer of the stack (Home or a page), moved with
// transform and opacity only: no clipping, no radius, no border, nothing
// that makes Android lay the page out again or clip a web view every
// frame. Its part (entering, leaving, under, hidden) is worked out on the
// UI thread from the stack's state. Memoised on props that never change
// for a layer, so its animated views render once and a transition never
// re-renders them: with Reanimated's fast path the values on screen are
// written straight to the native view, while React's props for it keep the
// ones it mounted with (opacity 0 and a quarter to the right, for a page
// that slid in) until Reanimated syncs them back after the motion settles.
// Since 4.7.1 Reanimated writes the newest values again after each React
// mount (4.5 showed the stale ones for a frame); a render we skip is still
// work saved mid-motion. What changes with a layer's
// part (touches, focus) lives in LayerBody. Layers below the top stay
// mounted and laid out, only invisible: a web UI or a terminal under a page
// keeps its state and its size.
function PageLayer({ layerKey, page, home, width }: Props) {
  const t = useTheme();
  const style = useAnimatedStyle(() => {
    const role = roleOf(layerKey, {
      kind: motionKind.value,
      moving: movingKey.value,
      under: underKey.value,
      top: topKey.value,
      below: belowKey.value,
      previewing: previewing.value,
    });
    const m = { push: pushProgress.value, pull: pullProgress.value, commit: commitProgress.value, edge: pullEdge.value };
    return layerStyle(role, m, width);
  }, [layerKey, width]);
  const scrim = useAnimatedStyle(() => {
    const role = roleOf(layerKey, {
      kind: motionKind.value,
      moving: movingKey.value,
      under: underKey.value,
      top: topKey.value,
      below: belowKey.value,
      previewing: previewing.value,
    });
    const m = { push: pushProgress.value, pull: pullProgress.value, commit: commitProgress.value, edge: pullEdge.value };
    return { opacity: scrimOpacity(role, m) };
  }, [layerKey]);
  const layer = useMemo(() => [StyleSheet.absoluteFill, { backgroundColor: t.bg }, style], [t.bg, style]);
  const dim = useMemo(() => [StyleSheet.absoluteFill, { backgroundColor: '#000' }, scrim], [scrim]);

  return (
    <Animated.View style={layer} pointerEvents="box-none">
      <LayerBody layerKey={layerKey}>{page ? <PageView route={page.route} /> : home}</LayerBody>
      <Animated.View pointerEvents="none" style={dim} />
    </Animated.View>
  );
}

export default memo(PageLayer);
