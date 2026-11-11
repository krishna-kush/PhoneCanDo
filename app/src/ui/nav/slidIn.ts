import { createContext, startTransition, useContext, useEffect, useState } from 'react';
import { useRestedOnce } from './transitionStore';

// Whether the page around a component has finished sliding in. A page draws
// its first screen when it opens and the rest once this turns true
// (AfterSlide.tsx), so a tap starts the slide without waiting for the whole
// page. Home and a page drawn at rest are slid in from the start.
export const SlidInContext = createContext(true);

export function useSlidIn(): boolean {
  return useContext(SlidInContext);
}

/** A list on a page: its first `count` items while the page slides in, all of them after. */
export function useSlidInList<T>(items: T[], count: number): T[] {
  const slidIn = useSlidIn();
  return slidIn || items.length <= count ? items : items.slice(0, count);
}

/**
 * A layer's value for SlidInContext (LayerBody.tsx): true once the stack has
 * come to rest with the layer drawn. The flip is a transition, so the rest of
 * the page mounts in slices React can interrupt: a tap or Back right after
 * the slide is not held up by it.
 */
export function useLayerSlidIn(): boolean {
  const rested = useRestedOnce();
  const [slidIn, setSlidIn] = useState(rested);
  useEffect(() => {
    if (rested && !slidIn) startTransition(() => setSlidIn(true));
  }, [rested, slidIn]);
  return slidIn;
}
