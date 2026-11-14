// The drop: out of A-01's pupil, the site's headline slammed down a word
// group a hit, the amber squiggle under `use`, and A-01 itself leaping out
// of the camera to land on top of the red word and dance there. Then the
// stage crew strikes it: A-01 leaps off into the wings, ropes haul the
// words up and out, and two movers carry the next page in.

import { outBack, outCubic, outExpo } from '../../motion/ease.ts';
import { hit, lerp, pulse, seg } from '../../motion/tween.ts';
import { title as S } from '../../timeline/script/title.ts';
import { el, place, svgEl } from '../el.ts';
import { makeWords, slam } from '../parts/words.ts';
import { makeCarry } from '../stagehands/carry.ts';
import { leapOff, makeRopes, type Box } from '../stagehands/ropes.ts';
import { byShape, type Stage } from '../stage.ts';
import { lookOf, makeUnit } from '../unit/draw.ts';
import { blinking, bob } from '../unit/moves.ts';
import type { Ctx, View } from './scene.ts';

type Layout = { x: number; y: number; w: number; font: number; size: number };

const layout = (st: Stage): Layout =>
  byShape<Layout>(
    st,
    { x: 88.9, y: 56, w: 160, font: 20, size: 16 },
    { x: 50, y: 94, w: 94, font: 19, size: 14 },
    { x: 50, y: 58, w: 94, font: 15, size: 12 },
  );

export function makeTitle({ st }: Ctx): View {
  const L = layout(st);
  const root = el('div', '');
  const cam = el('div', 'layer', root);
  const head = makeWords(cam, `${S.text.pre} *${S.text.verb}* ${S.text.post}`);
  head.el.classList.add('pin');
  head.el.style.cssText += `width:${L.w * st.u}px;font-size:${L.font * st.u}px;text-align:center;line-height:0.9;`;
  const verb = head.words[S.text.pre.split(' ').length];
  const squiggle = svgEl('svg', { class: 'draw' }, cam);
  const wave = svgEl('path', { fill: 'none', stroke: 'var(--amber)', 'stroke-width': 0.9 * st.u, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, squiggle);
  const unit = makeUnit(cam, L.size * st.u);

  // The word groups the rope crew hauls off: before `use`, `use`, after it.
  const at0 = head.words.indexOf(verb);
  const groups = [head.words.slice(0, at0), [verb], head.words.slice(at0 + 1)];
  let boxes: Box[] = [];
  const boxOf = (ws: HTMLElement[]): Box => {
    const bw = head.el.offsetWidth / st.u;
    const bh = head.el.offsetHeight / st.u;
    const xs = ws.map((w) => L.x - bw / 2 + w.offsetLeft / st.u);
    const ys = ws.map((w) => L.y - bh / 2 + w.offsetTop / st.u);
    const x = Math.min(...xs);
    const y = Math.min(...ys);
    return { x, y, w: Math.max(...ws.map((w, i) => xs[i] + w.offsetWidth / st.u)) - x, h: Math.max(...ws.map((w, i) => ys[i] + w.offsetHeight / st.u)) - y };
  };
  const ropes = makeRopes(cam, st, S.at, groups.length, () => boxes);

  // Where `use` sits, in u, read once laid out.
  let word: { x: number; y: number; w: number; h: number } | null = null;
  const measure = () => {
    const bw = head.el.offsetWidth / st.u;
    const bh = head.el.offsetHeight / st.u;
    const x = L.x - bw / 2 + verb.offsetLeft / st.u;
    const y = L.y - bh / 2 + verb.offsetTop / st.u;
    word = { x, y, w: verb.offsetWidth / st.u, h: verb.offsetHeight / st.u };
    boxes = groups.map(boxOf);
    // A squiggle under it: a wave the word's width, drawn by its dash.
    const n = 5;
    const amp = 0.9;
    let d = `M0 0`;
    for (let i = 1; i <= n * 2; i++) d += ` Q${((i - 0.5) * word.w * st.u) / (n * 2)} ${(i % 2 ? -amp : amp) * st.u} ${(i * word.w * st.u) / (n * 2)} 0`;
    wave.setAttribute('d', d);
    const len = wave.getTotalLength();
    wave.style.strokeDasharray = `${len}`;
    wave.dataset.len = String(len);
  };

  return {
    el: root,
    gag: makeCarry(st, { from: S.at.carry, down: S.at.down, end: S.beats }),
    sky: (t) => ({ glow: 0.9 + 0.8 * hit(t, 0, 3) + 0.25 * pulse(t, 5), glowY: 0.55, glowR: 80, zoom: 1 + 0.03 * pulse(t, 5), dy: -t * 2 }),
    frame(t) {
      const punch = 1 + 0.18 * (1 - seg(t, 0, 0.6, outExpo));
      cam.style.transformOrigin = '50% 50%';
      cam.style.transform = `scale(${(punch * (1 + 0.012 * pulse(t, 6))).toFixed(4)})`;
      place(head.el, st, { x: L.x, y: L.y });
      if (!word) measure();
      const w = word as NonNullable<typeof word>;

      const words = head.words;
      const at = S.at;
      const first = words.indexOf(verb);
      slam(words.slice(0, first), t, at.pre, 0.07);
      slam([verb], t, at.verb, 0);
      slam(words.slice(first + 1), t, at.post, 0.08);

      // The words hauled off by the rope crew, swinging as they go.
      let hauled = 0;
      ropes.frame(t);
      groups.forEach((g, i) => {
        const dy = ropes.hauled(t, i);
        if (i === 1) hauled = dy;
        const r = dy > 0 ? Math.sin(t * 13 + i) * 4 : 0;
        for (const w of g) w.style.transform = `translateY(${(-dy * st.u).toFixed(1)}px) rotate(${r.toFixed(2)}deg) ${w.style.transform}`;
      });

      const len = Number(wave.dataset.len);
      squiggle.style.transform = `translate(${(w.x * st.u).toFixed(1)}px, ${((w.y + w.h * 0.93 - hauled) * st.u).toFixed(1)}px)`;
      wave.style.strokeDashoffset = String(len * (1 - seg(t, at.squiggle, at.squiggle + 0.4, outCubic)));

      // A-01: leaping out of the camera on the drop, over, down onto the verb.
      const land = 1.25;
      const k = seg(t, 0, land);
      const tx = w.x + w.w * 0.5;
      const ty = w.y + w.h * 0.26;
      const ux = lerp(st.W / 2, tx, outCubic(k));
      const uy = lerp(st.H * 0.9, ty, k) - 4 * 18 * k * (1 - k);
      const near = lerp(4, 1, outCubic(k));
      const air = t < land;
      const settle = seg(t, land, land + 0.4, outBack(3));
      const groove = bob(t, 0.12);
      // Off into the wings as the ropes come in.
      const leap = t >= S.at.leap ? leapOff(t, st, S.at, ux, uy) : undefined;
      unit.el.style.display = t >= S.at.leap && !leap ? 'none' : '';
      place(unit.el, st, leap ? { x: leap.x, y: leap.y, r: leap.r } : { x: ux, y: uy, r: air ? (1 - k) * 360 : 0, s: near });
      unit.draw(lookOf('plain'), {
        eyes: air || leap ? 'wide' : blinking(t, 4) ? 'shut' : 'happy',
        sx: air ? 0.92 : lerp(1.25, 1, settle) * groove.sx,
        sy: air ? 1.1 : lerp(0.7, 1, settle) * groove.sy,
        lift: air || leap ? 0 : groove.lift,
        shadow: air || leap ? 0 : 0.5,
        gaze: [0, 0.3],
      });
    },
  };
}
