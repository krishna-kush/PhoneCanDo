// The camera. It draws the scene playing and hands over to the next one in
// one of two ways. Going inside something, it dives: over the scene's last
// beat or so it opens a window in its portal (a screen, a pupil, a
// fingerprint's whorl) with the next scene already playing inside, then
// dives through it (dive.ts). Otherwise the stage crew changes the set by
// hand (a scene's `gag`, stagehands/). Once, at the very end, it runs the
// dive backwards: a scene with a `pull` turns out to have been inside
// another's portal all along.

import { inOutCubic } from '../../motion/ease.ts';
import { seg } from '../../motion/tween.ts';
import { SCENES, sceneAt, type SceneId } from '../../timeline/scenes.ts';
import { el } from '../el.ts';
import type { Backdrop } from '../parts/backdrop.ts';
import type { Gag, View } from '../scenes/scene.ts';
import type { Stage } from '../stage.ts';
import { diveInto, unturn, type Box } from './dive.ts';

/** How long the window takes to open before the dive starts, in beats. */
const OPEN = 0.3;

export type Director = (beat: number) => void;

/** What the camera shows at a beat: a scene, maybe another in its portal [k] of the way in, the window [open]. */
type Shot = { outer: View; t: number; inner?: View; ti: number; k: number; open: number };

/** [e]'s corner radius as drawn into [box] (px on the frame): its own, scaled as [e] is (a shrunk copy of a scene has shrunk corners). */
function radiusOf(e: Element, box: Box): string {
  const r = getComputedStyle(e).borderRadius;
  const { offsetWidth: w, offsetHeight: h } = e as HTMLElement;
  if (!w || !h || !/^[\d.]+px$/.test(r)) return r;
  return `${(parseFloat(r) * Math.sqrt((box.w * box.h) / (w * h))).toFixed(2)}px`;
}

/** Every view [views] draw, the ones pulled out to included. */
export const allViews = (views: Record<SceneId, View>): View[] => Object.values(views).flatMap((v) => (v.pull ? [v, v.pull.view] : [v]));

/** A director over [views] in [layer], each scene on its own [grounds]. */
export function makeDirector(st: Stage, layer: HTMLElement, views: Record<SceneId, View>, grounds: Map<HTMLElement, Backdrop>): Director {
  const win = el('div', 'portal');
  const lens = el('div', 'lens', win);
  const all = [...new Set(allViews(views).map((v) => v.el))];
  const gags = allViews(views).flatMap((v) => (v.gag ? [v.gag] : []));

  const draw = (view: View, t: number) => {
    grounds.get(view.el)?.set(view.sky?.(t) ?? {});
    view.frame(t);
  };

  const shot = (beat: number): Shot => {
    const { scene, local } = sceneAt(beat);
    const view = views[scene.id];
    const pull = view.pull;
    if (pull && local >= pull.at) return { outer: pull.view, t: local, inner: view, ti: local, k: 1 - seg(local, pull.at, pull.at + pull.len, inOutCubic), open: 1 };
    const after = SCENES[SCENES.indexOf(scene) + 1];
    const next = after ? views[after.id] : undefined;
    const at = scene.beats - (view.dive ?? 1);
    const peek = at - (view.peek ?? OPEN);
    if (!view.portal || !next || next.el === view.el || local < peek) return { outer: view, t: local, ti: 0, k: 0, open: 0 };
    return { outer: view, t: local, inner: next, ti: local - scene.beats, k: seg(local, at, scene.beats, inOutCubic), open: seg(local, peek, peek + OPEN) };
  };

  /** The window into the portal, and the camera's dive through it. */
  const portal = (s: Shot) => {
    const view = s.outer;
    const p = s.inner ? view.portal?.() : null;
    if (!p || !s.inner) {
      win.remove();
      return;
    }
    // The portal as drawn, before the camera moves, in px on the scene's frame.
    const frame = view.el.getBoundingClientRect();
    const scale = frame.width / st.w;
    const r = p.el.getBoundingClientRect();
    const angle = p.angle ?? 0;
    const box = unturn({ x: (r.left - frame.left) / scale, y: (r.top - frame.top) / scale, w: r.width / scale, h: r.height / scale }, angle);
    const d = diveInto(box, p.shape, st.w, st.h, s.k, angle);
    if (s.k > 0) {
      view.el.style.transformOrigin = '0 0';
      view.el.style.transform = `translate(${d.fx.toFixed(2)}px, ${d.fy.toFixed(2)}px) rotate(${d.turn.toFixed(3)}deg) scale(${d.scale.toFixed(5)}) translate(${(-d.fx).toFixed(2)}px, ${(-d.fy).toFixed(2)}px)`;
    }
    if (win.parentElement !== view.el) view.el.appendChild(win);
    const radius = p.shape === 'circle' ? '50%' : radiusOf(p.el, box);
    win.style.cssText = `left:${box.x}px;top:${box.y}px;width:${box.w}px;height:${box.h}px;border-radius:${radius};opacity:${s.open.toFixed(3)};transform:rotate(${angle}deg)`;
    lens.style.cssText = `left:${d.inner.x}px;top:${d.inner.y}px;width:${st.w}px;height:${st.h}px;transform:scale(${d.r.toFixed(6)})`;
    if (s.inner.el.parentElement !== lens) lens.appendChild(s.inner.el);
    draw(s.inner, s.ti);
  };

  return (beat) => {
    const s = shot(beat);
    const view = s.outer;
    const { scene, local } = sceneAt(beat);
    const i = SCENES.indexOf(scene);
    const after = SCENES[i + 1] ? views[SCENES[i + 1].id] : undefined;
    const next = after && after.el !== view.el ? after : undefined;
    // The crew changing the set to the next scene, or finishing up after changing it to this one.
    const gag = next && !s.inner && view.gag && local >= scene.beats - view.gag.len ? view.gag : undefined;
    const prev = i > 0 ? views[SCENES[i - 1].id] : undefined;
    const back: Gag | undefined = !gag && prev?.gag && prev.el !== view.el && local < (prev.gag.off ?? 0) ? prev.gag : undefined;

    if (view.el.parentElement !== layer || view.el !== layer.firstElementChild) layer.insertBefore(view.el, layer.firstChild);
    for (const e of all) {
      e.style.transform = '';
      e.style.transformOrigin = '';
      e.style.boxShadow = '';
      e.style.clipPath = '';
      e.style.opacity = '';
      e.classList.toggle('on', e === view.el || e === s.inner?.el || (gag !== undefined && e === next?.el));
    }
    draw(view, s.t);
    portal(s);
    if (gag && next) {
      if (next.el.parentElement !== layer) layer.appendChild(next.el);
      draw(next, local - scene.beats);
      gag.frame(local, view.el, next.el, layer);
    }
    back?.after?.(local, view.el, layer);
    for (const g of gags) if (g !== gag && g !== back) g.hide();
  };
}
