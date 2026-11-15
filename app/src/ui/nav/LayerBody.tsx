import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { PageActiveContext } from './pageActive';
import { SlidInContext, useLayerSlidIn } from './slidIn';
import { useLayerRole } from './transitionStore';

// What in a layer changes with its part: it is read out while in front (on
// top, or entering), takes touches and its page is active only on top. Not
// while entering: Reanimated's fast path moves the native view but not
// React's copy of it, which a press measures, so a tap right after the
// slide was judged where the slide began and dropped. Turning touches on at
// rest is a React commit, which writes the layer's real place back.
// The only part of a layer that re-renders in a transition: the
// animated view around it never does (PageLayer.tsx). Never flattened
// (collapsable false): a View whose only props are the defaults is folded
// into its parent, and turning pointerEvents on and off would then move the
// whole page (a web view too) to a new native parent at each transition.
// It also tells the page when its slide is over (slidIn.ts), once.
export default function LayerBody({ layerKey, children }: { layerKey: string; children: ReactNode }) {
  const role = useLayerRole(layerKey);
  const slidIn = useLayerSlidIn();
  const front = role === 'top' || role === 'enter';
  return (
    <View
      style={StyleSheet.absoluteFill}
      collapsable={false}
      pointerEvents={role === 'top' ? 'auto' : 'none'}
      importantForAccessibility={front ? 'auto' : 'no-hide-descendants'}
    >
      <PageActiveContext.Provider value={role === 'top'}>
        <SlidInContext.Provider value={slidIn}>{children}</SlidInContext.Provider>
      </PageActiveContext.Provider>
    </View>
  );
}
