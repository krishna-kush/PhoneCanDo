import { type ComponentRef, useCallback, useContext, useEffect, useRef } from 'react';
import type { View } from 'react-native';
import { inView } from './inView';
import { ViewportContext } from './viewport';

/**
 * Calls `onSeen` once, the first time the view given `ref` and `onLayout`
 * shows in the page's window (Screen's `viewport`), or at its first layout
 * on a page without one. Until then it measures the view against the
 * scroll content on each layout, scroll and resize; after, it stops.
 */
export function useSeenOnce(onSeen: () => void) {
  const viewport = useContext(ViewportContext);
  const ref = useRef<ComponentRef<typeof View>>(null);
  const seen = useRef(false);
  const unsubscribe = useRef<(() => void) | null>(null);
  const latest = useRef(onSeen);
  latest.current = onSeen;

  const check = useCallback(() => {
    if (seen.current) return;
    const see = () => {
      seen.current = true;
      unsubscribe.current?.();
      latest.current();
    };
    if (!viewport) return see();
    const row = ref.current;
    const content = viewport.content();
    if (!row || !content) return;
    row.measureLayout(content, (_x, top, _width, height) => {
      if (!seen.current && inView({ top, height }, viewport.view())) see();
    });
  }, [viewport]);

  useEffect(() => {
    if (!viewport || seen.current) return;
    unsubscribe.current = viewport.subscribe(check);
    return () => {
      unsubscribe.current?.();
      unsubscribe.current = null;
    };
  }, [viewport, check]);

  return { ref, onLayout: check };
}
