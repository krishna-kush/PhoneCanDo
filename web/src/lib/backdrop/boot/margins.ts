// The backdrop beside the home page's sheet (components/Backdrop.astro): a
// canvas in each margin, the story on the right and the playground on the
// left, a floor per part of the page. Answers clicks there and hands the
// playground's toys to your pointer to pick up and throw (and its empty
// floor, to shake or hold for jiggle mode). The frame loop is boot/loop.ts.

import { playWords, voices } from '../../../data/backdrop';
import { WIDE } from '../wide';
import { cameraY } from '../world/building';
import { startWorld } from './loop';

/** [root] holds a canvas for each margin: data-side "left" and "right". */
export function startBackdrop(root: HTMLElement) {
  const page = document.querySelector<HTMLElement>('.page');
  const left = root.querySelector<HTMLCanvasElement>('canvas[data-side="left"]');
  const right = root.querySelector<HTMLCanvasElement>('canvas[data-side="right"]');
  if (!page || !left || !right) return;
  const world = startWorld({
    root,
    canvases: [
      [right, 1],
      [left, -1],
    ],
    shown: matchMedia(WIDE),
    sheet: page,
    // Each margin's canvas as wide as the margin, and the eye level halfway down.
    place: (w, h) => {
      const sheet = page.getBoundingClientRect();
      const l = Math.max(0, sheet.left);
      const r = Math.min(w, sheet.right);
      return { left: l, right: r, band: null, widths: [w - r, l], cy: h / 2 };
    },
    camera: (floor, _little, floors) => cameraY(floor, floors),
    parts: () =>
      [...document.querySelectorAll<HTMLElement>('main > section, .page > footer')].map((el) => ({ el, key: el.id || el.classList[0] || '' })),
    playground: true,
  });
  if (!world) return;
  const { play, pokes, stir, say } = world;

  for (const canvas of [right, left]) {
    canvas.addEventListener('pointermove', (e) => {
      if (play.held || play.pressing) return play.move(e.clientX, e.clientY, performance.now() / 1000);
      const toy = play.find(e.clientX, e.clientY);
      canvas.style.cursor = toy ? (play.canTake(toy) ? 'grab' : 'pointer') : pokes.find(e.clientX, e.clientY) ? 'pointer' : '';
    });
    canvas.addEventListener('pointerdown', (e) => {
      stir();
      const now = performance.now() / 1000;
      // A toy in the playground: picked up (and woken, if it may be), saying
      // so; or asleep, while someone on its floor is awake to throw at it.
      const got = play.grab(e.clientX, e.clientY, now);
      if (got?.took) {
        say(got.toy.name, voices.app);
        canvas.setPointerCapture(e.pointerId);
        canvas.style.cursor = 'grabbing';
        return;
      }
      if (got) {
        say(got.toy.name, playWords.asleep);
        return;
      }
      // A lock: it opens, and says so as anything clicked does.
      play.unlock(e.clientX, e.clientY, now);
      if (world.poke(e.clientX, e.clientY)) return;
      // The playground's empty floor: your hand on it, to shake it or hold it for jiggle mode.
      if (canvas === left) {
        play.hold(e.clientX, e.clientY, now);
        canvas.setPointerCapture(e.pointerId);
      }
    });
    const letGo = () => {
      if (!play.held && !play.pressing) return;
      const toy = play.held;
      play.drop(performance.now() / 1000);
      canvas.style.cursor = toy ? 'grab' : '';
      stir();
    };
    canvas.addEventListener('pointerup', letGo);
    canvas.addEventListener('pointercancel', letGo);
  }
}
