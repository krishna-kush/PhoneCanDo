import { useCallback, useRef, useSyncExternalStore } from 'react';
import type { TamaguiElement } from 'tamagui';
import type { SpotId } from './ids';
import { addSpot, spotsVersion, subscribeSpots, type SpotNode, type SpotReach } from './registry';

/**
 * A ref that marks the view it lands on as spot [id] (none while id is
 * null): a View, or a Tamagui stack, whose ref on Android is its native
 * view (typed as the web's element).
 */
export function useSpot(id: SpotId | null, reach?: SpotReach): (node: SpotNode | TamaguiElement | null) => void {
  const drop = useRef<(() => void) | null>(null);
  const rx = reach?.x ?? 0;
  const ry = reach?.y ?? 0;
  return useCallback(
    (node: SpotNode | TamaguiElement | null) => {
      drop.current?.();
      drop.current =
        node && id ? addSpot(id, { node: node as SpotNode, reach: rx || ry ? { x: rx, y: ry } : undefined }) : null;
    },
    [id, rx, ry],
  );
}

/** Re-renders whenever a spot comes or goes. */
export function useSpotsVersion(): number {
  return useSyncExternalStore(subscribeSpots, spotsVersion);
}
