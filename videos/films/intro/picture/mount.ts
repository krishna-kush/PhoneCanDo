// The picture, built once into an element for a frame size: every scene,
// its ground, the camera, the flash and the HUD. It hands back how to draw
// any moment: each frame sets everything from the beat alone, so frames
// can be drawn in any order and in parallel, as Remotion draws them.
// film.tsx builds it once the fonts are in.

import type { Facts } from '../script/types.ts';
import { soundsOf } from '../script/cues.ts';
import { TOTAL } from '../script/scenes.ts';
import { el } from './el.ts';
import { LOOK, LOOKS } from './looks.ts';
import { makeBackdrop, type Backdrop } from './parts/backdrop.ts';
import { makeHud } from './parts/hud.ts';
import { makeImpacts } from './parts/impact.ts';
import { makeViews } from './scenes/index.ts';
import { makeStage } from './stage.ts';
import { applyTheme } from './theme.ts';
import { allViews, makeDirector } from './zoom/director.ts';

/** Draws the moment [beat] beats into the video. */
export type Draw = (beat: number) => void;

export function mount(root: HTMLElement, w: number, h: number, facts: Facts): Draw {
  const look = LOOKS[LOOK];
  applyTheme(root, look);
  const st = makeStage(root, w, h);

  const shaken = el('div', 'layer shaken', st.root);
  const views = makeViews({ st, facts });
  // Each scene on its own ground, so its grid zooms with it.
  const grounds = new Map<HTMLElement, Backdrop>();
  for (const view of allViews(views)) {
    if (grounds.has(view.el)) continue;
    view.el.classList.add('scene');
    shaken.appendChild(view.el);
    grounds.set(view.el, makeBackdrop(view.el, st, look.ground, look.glow));
  }
  const direct = makeDirector(st, shaken, views, grounds);
  const flash = el('div', 'flash', st.root);
  const hud = makeHud(st.root, 'phonecando.app');
  const impacts = makeImpacts(soundsOf(facts));

  return (at) => {
    const beat = Math.max(0, Math.min(at, TOTAL - 1e-6));
    direct(beat);
    const hit = impacts(beat);
    shaken.style.transform = `translate(${(hit.x * st.u).toFixed(2)}px, ${(hit.y * st.u).toFixed(2)}px) rotate(${hit.r.toFixed(3)}deg)`;
    flash.style.opacity = hit.flash.toFixed(3);
    hud.frame(beat);
  };
}
