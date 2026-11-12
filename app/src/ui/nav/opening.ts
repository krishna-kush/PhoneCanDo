import { useCallback, useId, useSyncExternalStore } from 'react';
import { whenAtRest } from './transitionStore';

// The row whose page is opening: its › turns into a spinner (OpenMark.tsx)
// from the tap until that page has slid in. The tap draws the spinner
// first and runs the row's action a frame later: a page is built in one
// render before it slides (usePageTransitions.ts), and a big one would
// otherwise leave the tap showing nothing until then. The spinner is
// native, so it turns while that render holds the JS thread. One row at a
// time: a tap on another row moves it there.
let openingId: string | null = null;
const listeners = new Set<() => void>();

function setOpening(id: string | null) {
  if (openingId === id) return;
  openingId = id;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function open(id: string, action: () => unknown) {
  if (openingId === id) return;
  setOpening(id);
  requestAnimationFrame(() => {
    let result: unknown;
    try {
      result = action();
    } catch (e) {
      if (openingId === id) setOpening(null);
      throw e;
    }
    // A push has set the stack moving by now; an action that pushes once it
    // is done (a promise) keeps the spinner until then. No push: it goes.
    void Promise.resolve(result)
      .catch(() => undefined)
      .then(() =>
        whenAtRest(() => {
          if (openingId === id) setOpening(null);
        }),
      );
  });
}

/**
 * A row that opens a page: `press` runs `action` as above, `opening` is
 * true while its spinner shows. A second tap on the row while it opens does
 * nothing, so it never opens the page twice.
 */
export function useOpening(action: (() => unknown) | undefined): { opening: boolean; press: (() => void) | undefined } {
  const id = useId();
  const opening = useSyncExternalStore(subscribe, () => openingId === id);
  const press = useCallback(() => {
    if (action) open(id, action);
  }, [id, action]);
  return { opening, press: action ? press : undefined };
}
