import { useSyncExternalStore } from 'react';

// Whether Home is the layer in front, as the stack's motion shows it
// (transitionStore.ts): it leaves the front once a page has started to
// slide over it and comes back once the last page has slid off. Home's own
// UI reads this, not the stack, so a page's open and Back never wait on a
// render of Home: what changes with it (an agent face holding still, the
// engine marked used, the chat on screen, the TUI's keyboard) follows the
// motion instead of holding it up.
let inFront = true;
const listeners = new Set<() => void>();

export function setHomeInFront(next: boolean) {
  if (next === inFront) return;
  inFront = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const read = () => inFront;

export function useHomeInFront(): boolean {
  return useSyncExternalStore(subscribe, read);
}
