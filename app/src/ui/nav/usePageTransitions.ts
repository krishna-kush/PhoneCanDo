import { useLayoutEffect } from 'react';
import { startPushOf, useShown, watchStack } from './transitionStore';
import { layersOf, type Layer } from './transitions';

export type { Layer };

// The layers PageStack draws, from the stack as drawn (transitionStore.ts,
// which follows the app's page stack and runs the motion). One render per
// change of the stack. A new page slides in once its layer has committed,
// so it is never seen half built.
export function usePageTransitions(): Layer[] {
  const shown = useShown();

  useLayoutEffect(() => watchStack(), []);

  // Runs right after the commit that mounted the new page.
  useLayoutEffect(() => {
    if (shown.anim?.kind === 'push') startPushOf(shown.anim.id);
  }, [shown.anim]);

  return layersOf(shown);
}
