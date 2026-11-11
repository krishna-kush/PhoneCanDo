import { createContext, type ComponentRef, type RefObject } from 'react';
import type { ScrollView } from 'react-native';
import type { Span } from './inView';

type Scroll = ComponentRef<typeof ScrollView>;

/**
 * A scrolling page's window, for rows that act when they come into view
 * (useSeenOnce). Screen makes one when asked (its `viewport` prop) and
 * feeds it its ScrollView's scroll and size; a change tells the
 * subscribers without a render.
 */
export type Viewport = {
  /** The scroll content's inner view: rows measure themselves against it. */
  content(): ReturnType<Scroll['getInnerViewRef']>;
  /** The window over the content now. */
  view(): Span;
  /** Calls `listener` after each scroll or resize; returns the unsubscribe. */
  subscribe(listener: () => void): () => void;
};

export type ViewportFeed = Viewport & {
  scrolled(top: number): void;
  resized(height: number): void;
};

export const ViewportContext = createContext<Viewport | null>(null);

export function createViewport(scroll: RefObject<Scroll | null>): ViewportFeed {
  let view: Span = { top: 0, height: 0 };
  const listeners = new Set<() => void>();
  const tell = () => listeners.forEach((listener) => listener());
  return {
    content: () => scroll.current?.getInnerViewRef() ?? null,
    view: () => view,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    scrolled: (top) => {
      view = { ...view, top };
      tell();
    },
    resized: (height) => {
      view = { ...view, height };
      tell();
    },
  };
}
