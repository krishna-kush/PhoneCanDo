import { useSyncExternalStore } from 'react';
import { useAppStore } from '../../state/app';
import type { Page } from '../../state/app/stack';
import { setTransitionBusy } from './backTarget';
import { setHomeInFront } from './homeInFront';
import type { LayerRole } from './motion';
import { beginPop, beginPush, rest, startPush } from './stackMotion';
import { belowOf, HOME, keyOf, roleIn, stepFor, topOf, type Shown } from './transitions';

// The stack as drawn, kept in step with the app's page stack the moment it
// changes: a store subscription, not a React effect, so the motion never
// waits for a render. Back starts its slide right here on the UI thread
// (stackMotion.ts), before React draws anything; a new page has its parts
// set here and slides once it is built (startPushOf). React draws the
// layers from this in one render per change (usePageTransitions.ts), and a
// layer's part (LayerBody.tsx) re-renders only the layers whose part moved.
let current: Shown = { pages: [], anim: null };
let nextId = 1;
let startedPush = 0;
const listeners = new Set<() => void>();

function show(next: Shown) {
  current = next;
  listeners.forEach((listener) => listener());
}

function settleAt(pages: readonly Page[]) {
  const top = topOf(pages);
  rest(top, belowOf(pages));
  setHomeInFront(top === HOME);
}

function apply(pages: readonly Page[]) {
  const step = stepFor(current, pages, nextId);
  switch (step.kind) {
    case 'none':
      return;
    case 'same':
    case 'rest':
      if (step.kind === 'rest' || step.rest) settleAt(pages);
      show(step.shown);
      return;
    case 'push':
      nextId++;
      beginPush(step.anim.id, step.anim.top, step.anim.under);
      setTransitionBusy(true);
      show(step.shown);
      return;
    case 'pop': {
      nextId++;
      beginPop(step.anim.id, keyOf(step.anim.leaving), step.anim.reveal, settle);
      setTransitionBusy(true);
      show(step.shown);
    }
  }
}

// A motion that ran to its end (its id: a worklet hands back copies, not
// the object): back to rest, then the stack as it is now.
function settle(id: number) {
  if (current.anim?.id !== id) return;
  settleAt(current.pages);
  show({ pages: current.pages, anim: null });
  setTransitionBusy(false);
}

function pushStarted() {
  // Home's own UI follows (homeInFront.ts) once the page is on its way.
  setHomeInFront(false);
}

/** Follows the app's page stack until the returned function is called (PageStack's lifetime). */
export function watchStack(): () => void {
  const pages = useAppStore.getState().pages;
  current = { pages, anim: null };
  settleAt(pages);
  setTransitionBusy(false);
  listeners.forEach((listener) => listener());
  return useAppStore.subscribe((s, prev) => {
    if (s.pages !== prev.pages) apply(s.pages);
  });
}

/** The page of a push is committed: its slide starts (once per push). */
export function startPushOf(id: number) {
  if (startedPush === id || current.anim?.id !== id) return;
  startedPush = id;
  startPush(id, pushStarted, settle);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const read = () => current;

export function useShown(): Shown {
  return useSyncExternalStore(subscribe, read);
}

/** One layer's part; its component re-renders only when that part changes. */
export function useLayerRole(key: string): LayerRole {
  return useSyncExternalStore(subscribe, () => roleIn(current, key));
}
