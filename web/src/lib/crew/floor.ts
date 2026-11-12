// What the floor plan's parts share (lib/crew/): its elements, its agents,
// the runner's limits and whether you are here or away.

import type { Limits } from './rules';
import type { Seat } from './seats';

export type Floor = {
  root: HTMLElement;
  stage: HTMLElement;
  /** The runner's chute every note goes through. */
  chute: HTMLElement;
  /** The stamp across the whole stage, for what no one agent gets. */
  glass: HTMLElement;
  seats: Seat[];
  limits: Limits;
  still: MediaQueryList;
  /** You left: PhoneCanDo in the background, the screen off. */
  away: boolean;
  /** The plan is on screen; off it, nobody's turn moves on. */
  onScreen: boolean;
  say(line: string): void;
};

export const later = (ms: number, then: () => void) => window.setTimeout(then, ms);

export const restart = (el: HTMLElement, attr: string, value = '') => {
  el.removeAttribute(attr);
  void el.offsetWidth;
  el.setAttribute(attr, value);
};

/** Slams the stage-wide stamp with [head] over [sub]. */
export function slamGlass(floor: Floor, [head, sub]: [string, string]) {
  const [b, small] = floor.glass.children as HTMLCollectionOf<HTMLElement>;
  b.textContent = head;
  small.textContent = sub;
  restart(floor.glass, 'data-on');
}
