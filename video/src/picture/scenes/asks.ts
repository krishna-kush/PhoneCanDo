// Just ask, as a page of the field manual (chores.ts and scratch.ts on the
// timeline): the site's demo asks join a numbered list one by one, each
// stamped done, while FIG. 04 shows A-01 in the uniform for each. Then one
// more ask, a record scratch, the page frozen grey: wait. fix the build?
// Yep. And the crew rolls the page up like a theatre's roll drop, the
// machine behind it: FIG. 05, the body apart.

import { outBack, outCubic } from '../../motion/ease.ts';
import { hit, pulse, seg } from '../../motion/tween.ts';
import { chores as C, stampOf, type Ask } from '../../timeline/script/chores.ts';
import { scratch as X } from '../../timeline/script/scratch.ts';
import { el, place, svgEl } from '../el.ts';
import { bubbleAt, makeBubble } from '../parts/bubble.ts';
import { makeBurst } from '../parts/burst.ts';
import { makeStamp, stampAt } from '../parts/stamp.ts';
import { makeRoll } from '../stagehands/roll.ts';
import { typeOn } from '../parts/words.ts';
import { byShape, type Stage } from '../stage.ts';
import { lookOf, makeUnit } from '../unit/draw.ts';
import { blinking, bob, hop } from '../unit/moves.ts';
import type { Ctx, View } from './scene.ts';

type Box = { x: number; y: number; w: number; h: number };

type Layout = {
  head: [number, number];
  intro: { x: number; y: number; w: number; font: number };
  rows: { x: number; y: number; step: number; font: number; stamp: number; size: number; bar: number };
  fig: Box & { unit: number };
  next: Box;
  caption: [number, number, number];
  bubble: [number, number];
};

const layout = (st: Stage): Layout =>
  byShape<Layout>(
    st,
    {
      head: [12, 17],
      intro: { x: 12, y: 26.5, w: 92, font: 2.5 },
      rows: { x: 12, y: 36, step: 7.4, font: 4.3, stamp: 99, size: 0.72, bar: 94 },
      fig: { x: 112, y: 14, w: 54, h: 52, unit: 22 },
      next: { x: 112, y: 76, w: 32, h: 16 },
      caption: [56, 48, 6],
      bubble: [143, 33],
    },
    {
      head: [7, 15],
      intro: { x: 7, y: 23, w: 86, font: 2.5 },
      rows: { x: 7, y: 32, step: 7, font: 3.9, stamp: 84, size: 0.62, bar: 88 },
      fig: { x: 8, y: 86, w: 84, h: 50, unit: 22 },
      next: { x: 8, y: 146, w: 36, h: 18 },
      caption: [50, 66, 6.4],
      bubble: [56, 104],
    },
    {
      head: [6, 13],
      intro: { x: 6, y: 20, w: 56, font: 2 },
      rows: { x: 6, y: 27, step: 6.2, font: 3.1, stamp: 56, size: 0.5, bar: 56 },
      fig: { x: 65, y: 12, w: 31, h: 46, unit: 14 },
      next: { x: 65, y: 70, w: 24, h: 13 },
      caption: [34, 44, 4.2],
      bubble: [82, 30],
    },
  );

/** The scratch's ask, on the asks' beat line after the chores. */
const LAST: Ask = { ask: X.text.ask, tags: X.text.tags, design: X.design, at: C.beats + X.at.ask, len: X.beats };
const ASKS: readonly Ask[] = [...C.asks, LAST];
const X_AT = Object.fromEntries(Object.entries(X.at).map(([k, v]) => [k, v + C.beats])) as Record<keyof typeof X.at, number>;

/** FIG. 05's drawing: the body's plates, lifted apart. */
function drawPlates(box: HTMLElement) {
  const svg = svgEl('svg', { viewBox: '0 0 100 60', preserveAspectRatio: 'xMidYMid meet' }, box);
  for (let i = 0; i < 5; i++) {
    const y = 8 + i * 9;
    svgEl('polygon', { points: `30,${y} 70,${y} 82,${y + 10} 18,${y + 10}`, fill: 'var(--panel2)', stroke: i === 3 ? 'var(--amber)' : 'var(--line-strong)', 'stroke-width': 1.4 }, svg);
  }
  for (const x of [38, 50, 62]) svgEl('circle', { cx: x, cy: 22, r: 2.2, fill: 'var(--amber)' }, svg);
}

export function makeAsks({ st }: Ctx): { chores: View; scratch: View } {
  const L = layout(st);
  const root = el('div', '');
  const cam = el('div', 'layer', root);

  const head = el('div', 'pin page-head', cam, C.text.head);
  const intro = el('div', 'pin page-intro', cam, 'Say it the way you’d say it to a friend. A-01 does the tapping.');
  intro.style.width = `${L.intro.w * st.u}px`;
  intro.style.fontSize = `${L.intro.font * st.u}px`;
  const bar = el('div', 'ask-bar', cam);
  bar.style.width = `${L.rows.bar * st.u}px`;
  bar.style.height = `${L.rows.step * 0.82 * st.u}px`;
  const rows = ASKS.map((a, i) => {
    const row = el('div', 'pin ask-row', cam);
    el('b', '', row, String(i + 1).padStart(2, '0'));
    el('span', '', row, `“${a.ask}”`).style.fontSize = `${L.rows.font * st.u}px`;
    return row;
  });
  const stamps = C.asks.map(() => makeStamp(cam, C.text.done));

  // FIG. 04: A-01 in uniform, and the caption that names the ask's moves.
  const fig = el('div', 'figbox', cam);
  fig.style.cssText += `left:${L.fig.x * st.u}px;top:${L.fig.y * st.u}px;width:${L.fig.w * st.u}px;height:${L.fig.h * st.u}px;`;
  const cap = el('div', 'figcap', cam);
  const capTitle = el('span', '', cap);
  const capTags = el('small', '', cap);
  const unit = makeUnit(cam, L.fig.unit * st.u);
  const burst = makeBurst(cam, st);

  // FIG. 05: the next door.
  const next = el('div', 'figbox', cam);
  next.style.cssText += `left:${L.next.x * st.u}px;top:${L.next.y * st.u}px;width:${L.next.w * st.u}px;height:${L.next.h * st.u}px;`;
  drawPlates(next);
  const nextCap = el('div', 'figcap', cam);
  nextCap.innerHTML = 'Fig. 05 —<small>The body, apart</small>';

  const wait = el('div', 'pin caption', cam);
  const what = el('div', 'pin caption amber', cam);
  wait.style.fontSize = what.style.fontSize = `${L.caption[2] * st.u}px`;
  const yep = makeBubble(cam, X.text.yes);

  /** The ask on at [t]. */
  const current = (t: number) => {
    let i = 0;
    while (i + 1 < ASKS.length && t >= ASKS[i + 1].at) i++;
    return i;
  };
  const rowY = (i: number) => L.rows.y + i * L.rows.step;

  const frame = (t: number) => {
    const frozen = t >= X_AT.scratch && t < X_AT.yes;
    const grey = frozen ? 1 : t >= X_AT.yes ? 1 - seg(t, X_AT.yes, X_AT.yes + 0.4) : 0;
    const jerk = t >= X_AT.scratch && t < X_AT.scratch + 0.18 ? (Math.floor(t * 40) % 2 ? 1 : -1) * 1.2 : 0;
    cam.style.transform = `translateX(${(jerk * st.u).toFixed(1)}px) scale(${(1 + 0.006 * pulse(t, 6) * (frozen ? 0 : 1)).toFixed(4)})`;
    root.style.filter = grey > 0 ? `grayscale(${grey.toFixed(3)}) brightness(${(1 - 0.12 * grey).toFixed(3)})` : '';

    // The page's head and intro are printed already; the list grows.
    place(head, st, { x: L.head[0], y: L.head[1], ax: 0, ay: 0.5, r: -2.5 });
    place(intro, st, { x: L.intro.x, y: L.intro.y, ax: 0, ay: 0.5 });
    const i = current(t);
    rows.forEach((row, k) => {
      const a = ASKS[k];
      const inK = seg(t, a.at, a.at + 0.25, outCubic);
      place(row, st, { x: L.rows.x - (1 - inK) * 6, y: rowY(k), ax: 0, ay: 0.5, o: inK, blur: (1 - inK) * 0.5 });
    });
    const from = rowY(Math.max(0, i - 1));
    const slide = seg(t, ASKS[i].at, ASKS[i].at + 0.2, outCubic);
    place(bar, st, { x: L.rows.x - 2.2, y: i === 0 ? rowY(0) : from + (rowY(i) - from) * slide, ax: 0, ay: 0.5, o: t >= ASKS[0].at ? 1 : 0 });
    C.asks.forEach((a, k) => stampAt(stamps[k], st, t, stampOf(a), L.rows.stamp, rowY(k), -10 + (k % 3) * 6, L.rows.size));

    // FIG. 04: a uniform for each ask, bobbing to the beat, a hop when it's stamped.
    const a = ASKS[i];
    typeOn(capTitle, 'Fig. 04 — A-01, in uniform', t, -2, 0.02);
    typeOn(capTags, t < 0 ? '' : a.tags.join(' · '), t, a.at, 0.01);
    place(cap, st, { x: L.fig.x, y: L.fig.y + L.fig.h + 1.2, ax: 0, ay: 0 });
    place(nextCap, st, { x: L.next.x + L.next.w + 2, y: L.next.y + L.next.h / 2, ax: 0, ay: 0.5 });
    const stampT = i < C.asks.length ? stampOf(a) : Infinity;
    const leap = hop(t, stampT, 0.5, 0.35, 0.15);
    const groove = frozen ? { lift: 0, sx: 1, sy: 1 } : bob(t, 0.05);
    const change = hit(t, a.at, 9);
    const ux = L.fig.x + L.fig.w / 2;
    const uy = L.fig.y + L.fig.h - 4;
    place(unit.el, st, { x: ux, y: uy });
    const air = leap.lift > 0;
    const eyes = frozen ? 'wide' : t >= X_AT.yes ? 'happy' : air || (t > stampT && t < stampT + 1) ? 'happy' : blinking(t, 2) ? 'shut' : 'dot';
    unit.draw(lookOf(t < 0 ? 'plain' : a.design), {
      eyes,
      gaze: frozen ? [0, 0] : [Math.sin(t * 0.9) * 0.4, 0.15],
      sx: leap.sx * groove.sx * (1 + 0.25 * change),
      sy: leap.sy * groove.sy * (1 - 0.3 * change),
      lift: leap.lift + groove.lift,
      shadow: 0.35,
    });
    burst.draw(t, a.at + 0.02, ux, uy - L.fig.unit * 0.6, L.fig.unit * 0.9);

    // The scratch: the captions, and A-01's answer; FIG. 05 lights up as the next door.
    const capOut = t >= X_AT.yes ? 1 - seg(t, X_AT.yes, X_AT.yes + 0.3) : 1;
    const [cx, cy, cf] = L.caption;
    place(wait, st, { x: cx, y: cy, o: capOut, s: t >= X_AT.wait ? 1 + 0.15 * hit(t, X_AT.wait, 10) : 1 });
    typeOn(wait, X.text.wait, t, X_AT.wait, 0.04);
    place(what, st, { x: cx, y: cy + cf * 1.4, o: capOut, s: t >= X_AT.what ? 1 + 0.15 * hit(t, X_AT.what, 10) : 1 });
    typeOn(what, X.text.what, t, X_AT.what, 0.03);
    bubbleAt(yep, st, t, X_AT.yes, C.beats + X.beats + 1, L.bubble[0], L.bubble[1]);
    next.style.boxShadow = `0 0 0 ${(seg(t, X_AT.yes, X_AT.yes + 0.3, outBack(2)) * 0.5 * st.u).toFixed(2)}px var(--red)`;
  };

  const sky = (t: number) => ({ gx: 0.4, gy: 0.5, dx: -t * 0.6, glow: 0.35, glowX: (L.fig.x + L.fig.w / 2) / st.W, glowY: 0.4, glowR: 60 });

  return {
    chores: { el: root, frame, sky },
    scratch: { el: root, frame: (t) => frame(t + C.beats), sky: (t) => sky(t + C.beats), gag: makeRoll(st, { from: X.at.roll, end: X.beats }) },
  };
}
