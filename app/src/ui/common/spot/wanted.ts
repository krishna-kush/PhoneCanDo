import { useSyncExternalStore } from 'react';
import type { SpotId } from './ids';

// The spots a guide is looking for now. Spots that cost something to find
// (a web page's, which the page itself reports: chat/useWebSpots.ts) are
// looked for only while one of them is wanted.

let wanted: readonly SpotId[] = [];
const listeners = new Set<() => void>();

/** The guide looks for [ids] now; none: it looks for nothing. */
export function wantSpots(ids: readonly SpotId[]) {
  if (ids.length === wanted.length && ids.every((id, i) => id === wanted[i])) return;
  wanted = ids;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useWantedSpots(): readonly SpotId[] {
  return useSyncExternalStore(subscribe, () => wanted);
}
