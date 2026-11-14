// The stretch (agents → crew): FIG. 08 is a live photo, the next scene
// already playing in it. Four of the crew hop onto its corners and haul
// them out past the frame's, each in its own time, and let go: the photo
// snaps to fill the frame with a wobble, and they tumble off. We're on set.

import { inOutCubic } from '../../motion/ease.ts';
import { lerp, seg } from '../../motion/tween.ts';
import { place } from '../el.ts';
import type { Gag } from '../scenes/scene.ts';
import type { Stage } from '../stage.ts';
import { hop } from '../unit/moves.ts';
import { makeCrew, sprint } from './crew.ts';
import { quadTransform, type Pt } from './quad.ts';

/** The stretch's moments, in the scene's beats: the photo develops, the crew lands on it, hauls, lets go, the scene's end. */
export type Stretch = { open: number; grab: number; pull: number; snap: number; end: number };

type Quad = [Pt, Pt, Pt, Pt];

const SIZE = 8;
/** How far past the frame they haul it, a share of the frame. */
const OVER = 0.06;
/** How long the wobble and the tumble run on into the next scene, in beats. */
const OFF = 0.5;
/** Where each stands on its corner, in u from it (top left, top right, bottom right, bottom left). */
const HOLD: Pt[] = [
  [6, 11],
  [-6, 11],
  [-6, -1.5],
  [6, -1.5],
];

/** [e]'s box as laid out in [root], in px, its transforms and its parents' left out. */
function laidOut(e: HTMLElement, root: HTMLElement) {
  let x = 0;
  let y = 0;
  for (let n: HTMLElement | null = e; n && n !== root; n = n.offsetParent as HTMLElement | null) {
    x += n.offsetLeft;
    y += n.offsetTop;
    const p = n.offsetParent as HTMLElement | null;
    if (p && p !== root) {
      x += p.clientLeft;
      y += p.clientTop;
    }
  }
  return { x, y, w: e.offsetWidth, h: e.offsetHeight };
}

/** The stretch of [photo], turned [angle] degrees about [pivot]'s middle on the page. */
export function makeStretch(st: Stage, at: Stretch, photo: HTMLElement, pivot: HTMLElement, angle: number): Gag {
  const crew = makeCrew(st, ['staff', 'operator', 'support', 'butler'], SIZE);
  const { w, h } = st;
  const frame: Quad = [
    [0, 0],
    [w, 0],
    [w, h],
    [0, h],
  ];
  const past = frame.map(([x, y]) => [w / 2 + (x - w / 2) * (1 + OVER), h / 2 + (y - h / 2) * (1 + OVER)] as Pt) as Quad;
  /** Each corner's way out, a unit vector. */
  const out = frame.map(([x, y]) => {
    const dx = x - w / 2;
    const dy = y - h / 2;
    const n = Math.hypot(dx, dy);
    return [dx / n, dy / n] as Pt;
  });

  /** The photo's corners on the page, in px. */
  const cornersOf = (page: HTMLElement): Quad => {
    const b = laidOut(photo, page);
    const p = laidOut(pivot, page);
    const cx = p.x + p.w / 2;
    const cy = p.y + p.h / 2;
    const a = (angle * Math.PI) / 180;
    const turn = ([x, y]: Pt): Pt => [cx + (x - cx) * Math.cos(a) - (y - cy) * Math.sin(a), cy + (x - cx) * Math.sin(a) + (y - cy) * Math.cos(a)];
    return [turn([b.x, b.y]), turn([b.x + b.w, b.y]), turn([b.x + b.w, b.y + b.h]), turn([b.x, b.y + b.h])];
  };

  /** Let go [x] beats ago: from past the frame to the frame, wobbling about it as it settles. */
  const settle = (x: number): Quad => {
    const k = Math.exp(-8 * x) * Math.cos(3 * Math.PI * x);
    return frame.map(([fx, fy], i) => [fx + (past[i][0] - fx) * k, fy + (past[i][1] - fy) * k] as Pt) as Quad;
  };

  /** The crew at [t] on corners [q] (px): landing, hauling, then flung off once let go. */
  const draw = (t: number, q: Quad) => {
    crew.hands.forEach(({ unit, look }, i) => {
      const [ox, oy] = out[i];
      const side = ox < 0 ? -1 : 1;
      const [hx, hy] = HOLD[i];
      const x = q[i][0] / st.u + hx;
      const y = q[i][1] / st.u + hy;
      const land = at.grab - 0.06 * (3 - i);
      unit.el.style.display = t > land - 0.35 ? '' : 'none';
      if (t < land) {
        // Hopping in from its side of the frame, onto its corner.
        const k = seg(t, land - 0.35, land);
        place(unit.el, st, { x: lerp(side < 0 ? -10 : st.W + 10, x, k), y: lerp(y + 8 * oy, y, k) - 4 * 14 * k * (1 - k), r: side * 360 * (1 - k) });
        unit.draw(look, { eyes: 'wide', sx: 0.92, sy: 1.1, shadow: 0 });
        return;
      }
      if (t >= at.snap) {
        // Let go: flung out and away, spinning.
        const f = t - at.snap;
        place(unit.el, st, { x: x + ox * 160 * f, y: y + oy * 120 * f - 30 * f + 90 * f * f, r: side * 900 * f });
        unit.draw(look, { eyes: 'wide', sx: 0.9, sy: 1.12, shadow: 0 });
        return;
      }
      // Hauling: leaning out, feet scrabbling, straining harder the further it goes.
      const pulling = t >= at.pull;
      const strain = seg(t, at.pull, at.snap);
      const step = pulling ? sprint(t, i) : hop(t, land, 0, 0, 0);
      const shiver = pulling ? Math.sin(t * 90 + i) * 1.5 * strain : 0;
      place(unit.el, st, { x, y, r: side * (pulling ? 12 + 10 * strain : 0) + shiver });
      unit.draw(look, {
        facing: pulling ? 'side' : 'front',
        toward: side > 0 ? -1 : 1,
        eyes: pulling ? (strain > 0.6 ? 'shut' : 'happy') : 'dot',
        gaze: [-side * 0.5, 0],
        sx: step.sx,
        sy: step.sy,
        lift: pulling ? step.lift * 0.5 : 0,
        shadow: 0,
      });
    });
  };

  return {
    len: at.end - at.open,
    off: OFF,
    frame(t, page, scene, layer) {
      crew.up(layer, scene);
      const rest = cornersOf(page);
      // Each corner hauled out in its own time, past the frame's; then let go.
      const q: Quad =
        t >= at.snap
          ? settle(t - at.snap)
          : (rest.map((p, i) => {
              const k = seg(t, at.pull + 0.07 * i, at.snap - 0.12 + 0.03 * i, inOutCubic);
              return [lerp(p[0], past[i][0], k), lerp(p[1], past[i][1], k)] as Pt;
            }) as Quad);
      scene.style.transformOrigin = '0 0';
      scene.style.transform = quadTransform(w, h, q);
      scene.style.opacity = seg(t, at.open, at.open + 0.3).toFixed(3);
      draw(t, q);
    },
    after(t, scene, layer) {
      crew.up(layer);
      const q = settle(t + at.end - at.snap);
      scene.style.transformOrigin = '0 0';
      scene.style.transform = quadTransform(w, h, q);
      draw(t + at.end, q);
    },
    hide: crew.hide,
  };
}
