// The body, apart (apart.ts on the timeline): FIG. 05 come alive, the site's
// FIG. 01A, the body lifted apart into its plates in 3D, each named with the
// site's own callouts. Then the stack turns to face us, lying sideways, the
// plates over and under Linux peel away, and the camera dives into the
// terminal on it: the terminal scene's own, so the dive lands in it. Before
// the turn, a crew unit pops up holding one more line, the local model,
// its leader dashed to A-01's plate: an extra you plug in, not a layer.

import { inOutCubic, outBack, outCubic } from '../../../../engine/motion/ease.ts';
import { hop } from '../unit/moves.ts';
import { lookOf, makeUnit } from '../unit/draw.ts';
import { lerp, seg } from '../../../../engine/motion/tween.ts';
import { apart as A, type Layer } from '../../script/apart.ts';
import { el, place, svgEl } from '../el.ts';
import { makeTerm } from '../parts/term.ts';
import { typeOn } from '../parts/words.ts';
import { byShape, type Stage } from '../stage.ts';
import type { Ctx, View } from './scene.ts';
import { termFont } from './terminal.ts';

type Layout = {
  stack: { x: number; y: number; h: number };
  legend: { x: number; y: number; step: number; font: number };
  /** The size of the unit presenting the local model's line, in u. */
  holder: number;
};

const layout = (st: Stage): Layout =>
  byShape<Layout>(
    st,
    { stack: { x: 124, y: 51, h: 64 }, legend: { x: 11, y: 22, step: 9.3, font: 2.4 }, holder: 6 },
    { stack: { x: 73, y: 100, h: 50 }, legend: { x: 4, y: 66, step: 9.5, font: 1.75 }, holder: 6 },
    { stack: { x: 68, y: 54, h: 46 }, legend: { x: 5, y: 24, step: 8.6, font: 1.6 }, holder: 4.5 },
  );

const LINUX = A.layers.findIndex((l) => l.id === 'linux');
const AGENT = A.layers.findIndex((l) => l.id === 'agent');

/** What each plate shows. */
function fillPlate(plate: HTMLElement, layer: Layer) {
  switch (layer.id) {
    case 'screen':
      plate.classList.add('glass');
      break;
    case 'apps': {
      const dots = el('div', 'dots', plate);
      for (let i = 0; i < 16; i++) el('i', i === 6 ? 'red' : '', dots);
      break;
    }
    case 'agent': {
      const s = el('div', 'sticker', plate);
      el('i', '', s);
      el('i', '', s);
      break;
    }
    case 'linux':
      el('pre', '', plate).innerHTML = '<b>~ $</b> apt install\n  ffmpeg\n<b>~ $</b> _';
      break;
    case 'keys': {
      const svg = svgEl('svg', { viewBox: '0 0 100 216' }, plate);
      const ink = { fill: 'none', stroke: 'var(--amber)', 'stroke-width': 4 };
      svgEl('circle', { cx: 50, cy: 80, r: 16, ...ink }, svg);
      svgEl('path', { d: 'M50 96 V150 M50 128 H62 M50 142 H60', ...ink }, svg);
      break;
    }
    case 'board': {
      el('div', 'chip', plate, 'arm64');
      for (const [l, t, w] of [[8, 20, 40], [52, 76, 40], [8, 86, 30]]) {
        const tr = el('i', 'trace', plate);
        tr.style.cssText = `left:${l}%;top:${t}%;width:${w}%`;
      }
      break;
    }
  }
}

export function makeApart({ st }: Ctx): View {
  const L = layout(st);
  const root = el('div', '');
  const cam = el('div', 'layer', root);

  // FIG. 01A: the plates, and their legend.
  const scene3d = el('div', 'apart3d', cam);
  const stack = el('div', 'stack3d', scene3d);
  const ph = L.stack.h * st.u;
  const pw = ph * (9 / 19.5);
  stack.style.width = `${pw}px`;
  stack.style.height = `${ph}px`;
  stack.style.setProperty('--pw', `${pw}px`);
  stack.style.setProperty('--ph', `${ph}px`);
  const layers = A.layers;
  const plates = layers.map((layer) => {
    const p = el('div', `plate${layer.phantom ? ' phantom' : ''}`, stack);
    fillPlate(p, layer);
    return p;
  });
  // Sideways on the Linux plate, for once the stack lies down: the terminal
  // scene's own terminal as it first shows, shrunk to fit and turned upright.
  const up = plates[LINUX].querySelector('pre') as HTMLElement;
  const side = el('div', 'mini', plates[LINUX]);
  side.style.width = `${st.w}px`;
  side.style.height = `${st.h}px`;
  side.style.transform = `translate(-50%, -50%) rotate(90deg) scale(${((pw - 3.2 * st.u) / st.h).toFixed(5)})`;
  const term = makeTerm(side, st, termFont(st));
  term.el.style.width = `${st.w}px`;
  term.el.style.height = `${st.h}px`;
  term.pad(0);
  // A mark on each plate by the corner that turns toward the legends, where
  // its leader ends: measured as drawn, so it rides the plate through every
  // lift and turn.
  const spots = plates.map((p) => el('i', 'spot', p));
  const fig = el('div', 'pin label fig', cam);
  const leaders = svgEl('svg', { class: 'leaders' }, cam);
  const legends = layers.map((layer, i) => {
    const g = el('div', `legend${layer.phantom ? ' phantom' : ''}`, cam);
    g.style.fontSize = `${L.legend.font * st.u}px`;
    const num = el('b', '', g);
    const name = el('span', '', g);
    const note = el('em', '', g);
    const line = svgEl('polyline', { fill: 'none', stroke: layer.phantom ? 'var(--red)' : 'var(--amber)', 'stroke-width': 0.18 * st.u }, leaders);
    if (layer.phantom) line.setAttribute('stroke-dasharray', `${0.8 * st.u} ${0.6 * st.u}`);
    const dot = svgEl('circle', { r: 0.55 * st.u, fill: layer.phantom ? 'var(--red)' : 'var(--amber)' }, leaders);
    return { g, num, name, note, line, dot, text: [String(i).padStart(2, '0'), layer.name, ` — ${layer.note}`] as const };
  });

  // The local model's line, and the crew unit that holds it up.
  const model = el('div', 'legend model', cam);
  model.style.fontSize = `${L.legend.font * st.u}px`;
  const modelNum = el('b', '', model);
  const modelName = el('span', '', model);
  const modelNote = el('em', '', model);
  const modelLine = svgEl('polyline', { fill: 'none', stroke: 'var(--amber)', 'stroke-width': 0.18 * st.u, 'stroke-dasharray': `${0.8 * st.u} ${0.6 * st.u}` }, leaders);
  const holder = makeUnit(cam, L.holder * st.u);
  const modelText = [String(layers.length).padStart(2, '0'), A.text.model.name, ` — ${A.text.model.note}`] as const;
  /** The line's whole width in u, measured once with every word in, so the unit at its end stands still while it types. */
  let modelW = 0;
  const widthOf = () => {
    if (!modelW) {
      [modelNum, modelName, modelNote].forEach((e, i) => {
        e.textContent = modelText[i];
        delete e.dataset.k;
      });
      modelW = model.offsetWidth / st.u;
    }
    return modelW;
  };

  /** Where [spot] is drawn now, in u on the camera's layer. */
  const anchorOf = (spot: HTMLElement, push: number, ox: number, oy: number): [number, number] => {
    const frame = root.getBoundingClientRect();
    const k = frame.width / st.w;
    const r = spot.getBoundingClientRect();
    const x = (r.left + r.width / 2 - frame.left) / k / st.u;
    const y = (r.top + r.height / 2 - frame.top) / k / st.u;
    return [ox + (x - ox) / push, oy + (y - oy) / push];
  };

  return {
    el: root,
    dive: A.beats - A.at.dive,
    portal: () => ({ el: term.el, shape: 'box' }),
    sky: (t) => ({ gx: L.stack.x / st.W, gy: 0.5, dx: t * 1.2, glow: 0.7, glowX: L.stack.x / st.W, glowY: 0.5, glowR: 60 }),
    frame(t) {
      // The turn: the stack lies down sideways to face us, ready for the dive.
      const turn = seg(t, A.at.turn, A.at.dive - 0.35, inOutCubic);
      const push = 1 + 0.12 * turn;
      cam.style.transformOrigin = `${L.stack.x * st.u}px ${L.stack.y * st.u}px`;
      cam.style.transform = `scale(${push.toFixed(4)})`;

      // The plates lift apart from FIG. 05's drawing, staggered, and keep turning a little.
      const drift = Math.sin(t * 0.5) * 4 * (1 - turn);
      place(stack, st, { x: L.stack.x, y: L.stack.y });
      stack.style.transform += ` rotateX(${(56 * (1 - turn)).toFixed(2)}deg) rotateZ(${lerp(-36 + drift, -90, turn).toFixed(2)}deg)`;
      const gap = 7.5 * st.u;
      plates.forEach((p, i) => {
        const lift = 6 - i;
        const k = 0.3 + 0.7 * seg(t, A.at.explode + 0.06 * i, A.at.explode + 0.8 + 0.06 * i, outBack(1.5));
        const z = (lift - 3) * gap * k;
        if (i === LINUX) {
          p.style.transform = `translateZ(${(z * (1 - turn)).toFixed(1)}px)`;
          return;
        }
        // Over Linux, off toward us; under it, down and away.
        const away = (i < LINUX ? 90 : -60) * st.u * turn;
        p.style.transform = `translateZ(${(z + away).toFixed(1)}px)`;
        p.style.opacity = String(1 - turn);
      });
      const sideways = seg(turn, 0.45, 0.85);
      up.style.opacity = String(1 - sideways);
      side.style.opacity = String(sideways);
      plates[LINUX].style.boxShadow = `inset 0 0 0 ${((0.2 + turn * 0.4) * st.u).toFixed(2)}px var(--amber)`;

      const fade = 1 - seg(t, A.at.turn, A.at.turn + 0.5);
      place(fig, st, { x: L.legend.x, y: L.legend.y - L.legend.step * 0.9, ax: 0, o: fade });
      typeOn(fig, A.text.fig, t, 0, 0.025);

      // Each legend typed in, its leader drawn out to its plate.
      legends.forEach((g, i) => {
        const at = A.at.labels + i * A.at.step;
        const y = L.legend.y + i * L.legend.step;
        place(g.g, st, { x: L.legend.x, y, ax: 0, o: t < at ? 0 : fade });
        typeOn(g.num, g.text[0], t, at, 0.03);
        typeOn(g.name, g.text[1], t, at + 0.06, 0.02);
        typeOn(g.note, g.text[2], t, at + 0.06 + g.text[1].length * 0.02, 0.012);
        const [px, py] = anchorOf(spots[i], push, L.stack.x, L.stack.y);
        const x0 = L.legend.x + g.g.offsetWidth / st.u + 1.5;
        const draw = seg(t, at, at + 0.35, outCubic);
        const ex = x0 + (px - x0) * draw;
        const ey = y + (py - y) * draw;
        const u = st.u;
        g.line.setAttribute('points', `${x0 * u},${y * u} ${Math.min(ex, x0 + 4) * u},${y * u} ${ex * u},${ey * u}`);
        g.line.style.opacity = t < at ? '0' : String(fade);
        g.dot.setAttribute('cx', String(ex * u));
        g.dot.setAttribute('cy', String(ey * u));
        g.dot.style.opacity = draw >= 1 ? String(fade) : '0';
      });

      // The local model: brought up from below the frame by a crew unit, presenting it at its end; a leader dashed on to A-01.
      const at = A.at.model;
      const rise = seg(t, at - 0.3, at, outBack(1.4));
      const y = L.legend.y + layers.length * L.legend.step;
      const shown = t >= at - 0.3;
      const lift = (1 - rise) * (st.H - y + 12);
      place(model, st, { x: L.legend.x, y: y + lift, ax: 0, o: shown ? fade : 0, r: (1 - rise) * -4 });
      const end = L.legend.x + widthOf();
      typeOn(modelNum, modelText[0], t, at - 0.3, 0.001);
      typeOn(modelName, modelText[1], t, at - 0.3, 0.001);
      typeOn(modelNote, modelText[2], t, at + 0.05, 0.012);
      const cheer = hop(t, at + 0.35, 0.35, 0.3, 0.1);
      const hx = end + 1.5 + L.holder * 0.6;
      place(holder.el, st, { x: hx, y: y + lift + L.holder * 0.45, o: shown ? fade : 0 });
      holder.draw(lookOf('inventor'), {
        eyes: t < at ? 'wide' : cheer.lift > 0 || t > at + 0.7 ? 'happy' : 'dot',
        gaze: [-0.8, -0.2],
        sx: cheer.sx,
        sy: cheer.sy,
        lift: cheer.lift,
        shadow: 0,
      });
      const [px, py] = anchorOf(spots[AGENT], push, L.stack.x, L.stack.y);
      const x0 = hx + L.holder * 0.7 + 1;
      const draw = seg(t, at + 0.2, at + 0.6, outCubic);
      const u = st.u;
      modelLine.setAttribute('points', `${x0 * u},${y * u} ${(x0 + (px - x0) * draw) * u},${(y + (py - y) * draw) * u}`);
      modelLine.style.opacity = draw > 0 ? String(fade) : '0';
    },
  };
}
