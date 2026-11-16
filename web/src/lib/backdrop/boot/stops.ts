// Where a swipe on the story page comes to rest (boot/story.ts): a stop at
// the top, one on each floor where its chapter has played to its last rest
// and Little has not set off yet (timeline.ts settled), and one at the end.
// Each is a marker the page snaps to on touch screens, where one fling would
// otherwise carry the story two or three floors on (pages/story.astro); a
// mouse wheel scrolls freely.

import { settled } from '../story/a07/timeline';
import { scrollFor } from '../track';
import type { Measured } from './loop';

/** Places [track]'s stops for the page as just measured. */
export function placeStops(track: HTMLElement, { bands, timeline, viewH, docH }: Measured) {
  const last = timeline.stretches.length - 1;
  const end = Math.max(0, docH - viewH);
  const at = [0, ...timeline.stretches.map((_, i) => (i === last ? end : scrollFor(bands, settled(timeline, i), viewH, docH)))];
  const top = track.getBoundingClientRect().top + scrollY;
  const marks = [...track.querySelectorAll<HTMLElement>('.story-stop')];
  at.forEach((y, k) => {
    let mark = marks[k];
    if (!mark) {
      mark = document.createElement('div');
      mark.className = 'story-stop';
      track.append(mark);
    }
    const css = `${y - top}px`;
    if (mark.style.top !== css) mark.style.top = css;
  });
  for (const mark of marks.slice(at.length)) mark.remove();
}
