// Which spots are on screen now, each with its view to measure. A spot
// marked twice (the same page twice in the stack) is the newest mark until
// it goes. Readers subscribe for marks coming and going (useSpots.ts);
// where a spot sits is measured when needed, never kept.
import type { ComponentRef } from 'react';
import type { View } from 'react-native';
import type { SpotId } from './ids';

/** How far a spot's press area reaches past what it shows (LinkRow's `reach`). */
export type SpotReach = { x: number; y: number };

/** A spot's native view, to measure. */
export type SpotNode = ComponentRef<typeof View>;

/**
 * A spot drawn inside its view rather than being it (a button in a web
 * page): where it sits there, in units the view is `across` wide. Whoever
 * marked it moves it in place as it moves.
 */
export type SpotInner = { x: number; y: number; width: number; height: number; across: number };

export type SpotMark = { node: SpotNode; reach?: SpotReach; inner?: SpotInner };

const marks = new Map<SpotId, SpotMark[]>();
const listeners = new Set<() => void>();
let version = 0;

function changed() {
  version++;
  for (const listener of listeners) listener();
}

/** Marks [id] on [mark]'s view; the return takes the mark away. */
export function addSpot(id: SpotId, mark: SpotMark): () => void {
  marks.set(id, [...(marks.get(id) ?? []), mark]);
  changed();
  return () => {
    const left = (marks.get(id) ?? []).filter((m) => m !== mark);
    if (left.length) marks.set(id, left);
    else marks.delete(id);
    changed();
  };
}

/** The newest mark of [id], if it is on screen. */
export function spotMark(id: SpotId): SpotMark | null {
  const list = marks.get(id);
  return list ? list[list.length - 1] : null;
}

export const hasSpot = (id: SpotId): boolean => marks.has(id);

export function subscribeSpots(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Bumped whenever a mark comes or goes. */
export const spotsVersion = (): number => version;
