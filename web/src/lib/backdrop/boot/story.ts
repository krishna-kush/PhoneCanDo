// The story on a page of its own (pages/story.astro), for screens too narrow
// for the margins. One canvas fills the view and the floors run across all
// of it; the story is told in a band down its middle, as wide as the words'
// column, where both margins' scenes are drawn (world/frame.ts View), so
// every chapter, which centres itself in its margin, plays in the middle.
// Its camera keeps the deck Little is on low in the view
// (world/storyCamera.ts), where the margins' rides the scroll.
// The page's own sections are the floors, a chapter each: scrolling it reads
// the story. A tap on someone there gets their line, as a click does beside
// the sheet; the playground stays on the home page.

import { COLUMN } from '../story/narration';
import { WIDE } from '../wide';
import { storyCameraY, storyHorizon } from '../world/storyCamera';
import { startWorld } from './loop';
import { placeStops } from './stops';

/** [root] holds the canvas; [track] the page's floors, each a section with its key in data-floor. */
export function startStory(root: HTMLElement, track: HTMLElement) {
  const canvas = root.querySelector('canvas');
  if (!canvas) return;
  const world = startWorld({
    root,
    canvases: [[canvas, 1]],
    shown: matchMedia(`not all and ${WIDE}`),
    sheet: track,
    place: (w, h) => {
      const band = Math.min(w, COLUMN);
      return { left: (w + band) / 2, right: (w - band) / 2, band, widths: [w], cy: storyHorizon(h) };
    },
    camera: (floor, little) => storyCameraY(floor, little),
    parts: () => [...track.querySelectorAll<HTMLElement>('[data-floor]')].map((el) => ({ el, key: el.dataset.floor ?? '' })),
    playground: false,
    measured: (page) => placeStops(track, page),
  });
  if (!world) return;
  // A click, not a press: a finger that lands on someone to scroll says nothing.
  canvas.addEventListener('click', (e) => {
    world.stir();
    world.poke(e.clientX, e.clientY);
  });
  canvas.addEventListener('pointermove', (e) => {
    canvas.style.cursor = world.pokes.find(e.clientX, e.clientY) ? 'pointer' : '';
  });
}
