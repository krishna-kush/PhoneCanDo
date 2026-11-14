// The catalogue (agents.ts on the timeline), a page of the field manual:
// every agent kind dealt onto it like a card, each with its own unit, read
// from the manifests so the hand is never short; the count in the heading
// ticks up with each; then One phone. stamped over them. FIG. 08 is a live
// photo of the crew; the stage crew stretches it to fill the frame, and
// we're on set with them.

import { DESIGNS } from '../../../../mascot/designs.ts';
import { SHAPES } from '../../../../mascot/body.ts';
import type { Look } from '../../../../mascot/look.ts';
import { outBack, outCubic } from '../../motion/ease.ts';
import { hash } from '../../motion/noise.ts';
import { hit, lerp, seg } from '../../motion/tween.ts';
import { agents as S, cardStep } from '../../timeline/script/agents.ts';
import { el, place } from '../el.ts';
import { makeStamp, stampAt } from '../parts/stamp.ts';
import { makeStretch } from '../stagehands/stretch.ts';
import { byShape, type Stage } from '../stage.ts';
import { makeUnit } from '../unit/draw.ts';
import { blinking } from '../unit/moves.ts';
import type { Ctx, View } from './scene.ts';

type Box = { x: number; y: number; w: number; h: number };

type Layout = {
  head: [number, number];
  intro: { x: number; y: number; w: number; font: number };
  cards: { x: number; y: number; cols: number; w: number; h: number; gap: number };
  photo: Box;
  stamp: [number, number, number];
};

const layout = (st: Stage): Layout =>
  byShape<Layout>(
    st,
    {
      head: [12, 17],
      intro: { x: 12, y: 26.5, w: 96, font: 2.5 },
      cards: { x: 12, y: 33, cols: 5, w: 17.6, h: 17.4, gap: 2.2 },
      photo: { x: 118, y: 30, w: 52, h: 29.25 },
      stamp: [62, 62, 1.7],
    },
    {
      head: [7, 15],
      intro: { x: 7, y: 23, w: 86, font: 2.5 },
      cards: { x: 7, y: 30, cols: 4, w: 20.5, h: 18, gap: 1.6 },
      photo: { x: 8, y: 128, w: 84, h: 47.25 },
      stamp: [50, 72, 1.6],
    },
    {
      head: [6, 13],
      intro: { x: 6, y: 20, w: 56, font: 2 },
      cards: { x: 6, y: 26, cols: 5, w: 11, h: 13, gap: 1.2 },
      photo: { x: 65, y: 26, w: 31, h: 17.4 },
      stamp: [34, 54, 1.1],
    },
  );

/** A card's unit: picked from its kind's name, so it keeps it render to render. */
function lookFor(label: string, i: number): Look {
  let h = 0;
  for (const c of label) h = (h * 31 + c.charCodeAt(0)) | 0;
  if (i === 0) return { design: 'plain', shape: 'square', swap: false };
  return {
    design: DESIGNS[Math.floor(hash(h, 1) * DESIGNS.length)].id,
    shape: SHAPES[Math.floor(hash(h, 2) * SHAPES.length)],
    swap: hash(h, 3) < 0.3,
  };
}

/** FIG. 08 is taped on a little crooked. */
const TILT = -2.5;

export function makeAgents({ st, facts }: Ctx): View {
  const L = layout(st);
  const C = L.cards;
  const root = el('div', '');
  const cam = el('div', 'layer', root);
  const n = facts.agents.length;
  const step = cardStep(n);

  const head = el('div', 'pin page-head', cam);
  const count = el('span', '', head);
  el('span', '', head, ` ${S.text.count}`);
  const intro = el('div', 'pin page-intro', cam);
  intro.style.width = `${L.intro.w * st.u}px`;
  intro.style.fontSize = `${L.intro.font * st.u}px`;
  intro.textContent = `${facts.agents[0]} ${S.text.intro}`;

  const cards = facts.agents.map((label, i) => {
    const card = el('div', `card${i === 0 ? ' lead' : ''}`, cam);
    card.style.width = `${C.w * st.u}px`;
    card.style.height = `${C.h * st.u}px`;
    el('div', 'label amber', card, i === 0 ? 'Built in' : `Agent ${String(i + 1).padStart(2, '0')}`);
    const face = el('div', 'face', card);
    el('div', `name${label.length > 11 ? ' long' : ''}`, card, label);
    const unit = makeUnit(face, C.w * 0.3 * st.u);
    const col = i % C.cols;
    const row = Math.floor(i / C.cols);
    const x = C.x + col * (C.w + C.gap) + C.w / 2;
    const y = C.y + row * (C.h + C.gap) + C.h / 2;
    return { card, face, unit, look: lookFor(label, i), x, y, r: (hash(i, 7) - 0.5) * 5, at: i * step };
  });
  const one = makeStamp(cam, S.text.one, 'fill');

  // FIG. 08: a live photo of the crew, the next scene, developing as the deal starts.
  const fig = el('div', 'figbox', cam);
  fig.style.cssText += `left:${L.photo.x * st.u}px;top:${L.photo.y * st.u}px;width:${L.photo.w * st.u}px;height:${L.photo.h * st.u}px;`;
  fig.style.transform = `rotate(${TILT}deg)`;
  const photo = el('div', 'photo', fig);
  const cap = el('div', 'figcap', cam);
  cap.innerHTML = `${S.text.fig}<small>${S.text.photo}</small>`;

  return {
    el: root,
    gag: makeStretch(st, { ...S.at, end: S.beats }, photo, fig, TILT),
    sky: (t) => ({ gx: 0.35, gy: 0.5, dx: -t * 0.6, glow: 0.35, glowX: (L.photo.x + L.photo.w / 2) / st.W, glowY: 0.4, glowR: 60 }),
    frame(t) {
      // The heading counts the hand as it's dealt.
      const dealt = cards.filter((c) => t >= c.at).length;
      count.textContent = String(dealt).padStart(2, '0');
      const last = dealt ? cards[dealt - 1].at : -10;
      count.style.display = 'inline-block';
      count.style.transform = `scale(${(1 + 0.25 * hit(t, last, 10)).toFixed(3)})`;
      place(head, st, { x: L.head[0], y: L.head[1], ax: 0, ay: 0.5, r: -2.5 });
      place(intro, st, { x: L.intro.x, y: L.intro.y, ax: 0, ay: 0.5 });

      cards.forEach((c, i) => {
        const k = seg(t, c.at, c.at + 0.35, outBack(1.3));
        const fly = seg(t, c.at, c.at + 0.35, outCubic);
        place(c.card, st, {
          x: lerp(st.W + 25, c.x, fly),
          y: lerp(st.H + 30, c.y, fly),
          r: lerp(70, c.r, k),
          o: t < c.at ? 0 : 1,
        });
        c.unit.el.style.transform = `translate(${((C.w * st.u) / 2 - 1.4 * st.u).toFixed(1)}px, ${(c.face.offsetHeight * 0.92).toFixed(1)}px)`;
        c.unit.draw(c.look, { eyes: t < c.at + 0.4 ? 'wide' : t >= S.at.one && t < S.at.one + 0.5 ? 'wide' : blinking(t, i + 3, 2.6) ? 'shut' : 'dot', gaze: [Math.sin(t + i) * 0.5, 0], shadow: 0 });
      });
      const [sx, sy, size] = L.stamp;
      stampAt(one, st, t, S.at.one, sx, sy, -7, size);

      place(cap, st, { x: L.photo.x, y: L.photo.y + L.photo.h + 1.2, ax: 0, ay: 0 });
    },
  };
}
