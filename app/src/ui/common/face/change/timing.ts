// When each piece of a change happens, from its start (specs.ts).
// Pure (zero RN imports).
import type { Change } from './specs.ts';

/** When its lid step [i] starts to move. */
export function stepAtMs(c: Change, i: number): number {
  return c.steps.slice(0, i).reduce((at, step) => at + step.ms + step.hold, c.sleepMs);
}

/** When its lids are done moving. */
export function lidsDoneMs(c: Change): number {
  return stepAtMs(c, c.steps.length);
}

/** When its marks start to hand over (dozing off: as the lids meet). */
export function handOverAtMs(c: Change): number {
  return c.handOverAt ?? lidsDoneMs(c);
}

/** Its whole length, start to end: from then on the face is its new mood. */
export function changeMs(c: Change): number {
  return Math.max(lidsDoneMs(c), handOverAtMs(c) + c.handOverMs);
}
