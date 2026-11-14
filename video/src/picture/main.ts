// The page: builds every scene once for the format in ?format=, then draws
// any moment on demand. window.__frame(seconds) is all a renderer calls;
// window.__ready settles once fonts and facts are in. Without ?render it
// also gets a preview bar for a person (preview.ts).

import { FORMATS, isFormat } from '../render/formats.ts';
import { soundsOf } from '../timeline/cues.ts';
import { TOTAL } from '../timeline/scenes.ts';
import type { Facts } from '../timeline/script/types.ts';
import { BEAT } from '../timeline/tempo.ts';
import { el } from './el.ts';
import { loadFonts } from './fonts.ts';
import { makeBackdrop, type Backdrop } from './parts/backdrop.ts';
import { makeHud } from './parts/hud.ts';
import { makeImpacts } from './parts/impact.ts';
import { startPreview } from './preview.ts';
import { makeViews } from './scenes/index.ts';
import { makeStage } from './stage.ts';
import { isLook, LOOK, LOOKS } from './looks.ts';
import { applyTheme } from './theme.ts';
import { allViews, makeDirector } from './zoom/director.ts';

declare global {
  interface Window {
    __ready: Promise<string>;
    __frame: (seconds: number) => void;
  }
}

window.__ready = boot();

async function boot(): Promise<string> {
  const params = new URLSearchParams(location.search);
  const id = params.get('format') ?? '16x9';
  const { w, h } = FORMATS[isFormat(id) ? id : '16x9'];
  const lookId = params.get('look');
  const look = LOOKS[isLook(lookId) ? lookId : LOOK];
  applyTheme(document.documentElement, look);
  const st = makeStage(document.getElementById('stage') as HTMLElement, w, h);
  const facts = (await (await fetch('/facts.json')).json()) as Facts;
  await loadFonts();

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

  window.__frame = (seconds) => {
    const beat = Math.max(0, Math.min(seconds / BEAT, TOTAL - 1e-6));
    direct(beat);
    const hit = impacts(beat);
    shaken.style.transform = `translate(${(hit.x * st.u).toFixed(2)}px, ${(hit.y * st.u).toFixed(2)}px) rotate(${hit.r.toFixed(3)}deg)`;
    flash.style.opacity = hit.flash.toFixed(3);
    hud.frame(beat);
  };
  window.__frame(0);
  if (!params.has('render')) startPreview(st, window.__frame, TOTAL * BEAT);
  return 'ok';
}
