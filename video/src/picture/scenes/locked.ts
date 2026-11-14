// It ships locked (locked.ts on the timeline), a page of the field manual:
// FIG. 10A, phone control's switch, locked; A-01 sneaks up to flip it
// itself and gets stamped NOPE; FIG. 10B, the fingerprint that alone arms
// it, scanned. Then the camera spirals into the print's whorl.

import { inOutCubic, outBack, outCubic } from '../../motion/ease.ts';
import { hit, lerp, seg } from '../../motion/tween.ts';
import { locked as S } from '../../timeline/script/locked.ts';
import { el, place, svgEl } from '../el.ts';
import { makeStamp, stampAt } from '../parts/stamp.ts';
import { byShape, type Stage } from '../stage.ts';
import { lookOf, makeUnit } from '../unit/draw.ts';
import { blinking, hop } from '../unit/moves.ts';
import type { Ctx, View } from './scene.ts';

type Layout = {
  head: [number, number];
  intro: { x: number; y: number; w: number; font: number };
  panel: { x: number; y: number };
  unit: { from: number; to: number; y: number; size: number };
  print: { x: number; y: number; size: number };
  nope: [number, number];
};

const layout = (st: Stage): Layout =>
  byShape<Layout>(
    st,
    {
      head: [12, 17],
      intro: { x: 12, y: 26.5, w: 96, font: 2.5 },
      panel: { x: 78, y: 58 },
      unit: { from: 14, to: 39, y: 86, size: 17 },
      print: { x: 145, y: 55, size: 30 },
      nope: [78, 72],
    },
    {
      head: [7, 15],
      intro: { x: 7, y: 23, w: 86, font: 2.5 },
      panel: { x: 50, y: 64 },
      unit: { from: 10, to: 30, y: 104, size: 16 },
      print: { x: 62, y: 134, size: 32 },
      nope: [50, 78],
    },
    {
      head: [6, 13],
      intro: { x: 6, y: 20, w: 56, font: 2 },
      panel: { x: 40, y: 50 },
      unit: { from: 6, to: 18, y: 86, size: 12 },
      print: { x: 78, y: 60, size: 20 },
      nope: [40, 62],
    },
  );

/** A thumbprint: arcs round a core, gaps where a print's ridges break. */
function printPaths(size: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < 7; i++) {
    const rx = size * (0.12 + i * 0.065);
    const ry = rx * 1.3;
    const a0 = (200 + i * 9) * (Math.PI / 180);
    const a1 = (520 - i * 11) * (Math.PI / 180);
    const p = (a: number) => `${(Math.cos(a) * rx).toFixed(1)} ${(Math.sin(a) * ry + size * 0.05).toFixed(1)}`;
    out.push(`M${p(a0)} A${rx.toFixed(1)} ${ry.toFixed(1)} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${p(a1)}`);
  }
  return out;
}

export function makeLocked({ st }: Ctx): View {
  const L = layout(st);
  const root = el('div', '');
  const cam = el('div', 'layer', root);

  const head = el('div', 'pin page-head', cam, S.text.head);
  const intro = el('div', 'pin page-intro', cam, S.text.intro);
  intro.style.width = `${L.intro.w * st.u}px`;
  intro.style.fontSize = `${L.intro.font * st.u}px`;

  // FIG. 10A, phone control's panel: its name, the switch and its state.
  const panel = el('div', 'control', cam);
  el('div', 'label amber', panel, S.text.state);
  const row = el('div', 'row', panel);
  el('div', 'what', row, 'Agents can tap');
  const sw = el('div', 'switch', row);
  const knob = el('div', 'knob', sw);
  const lock = svgEl('svg', { viewBox: '0 0 20 24' }, knob);
  svgEl('rect', { x: 2, y: 10, width: 16, height: 13, rx: 2, fill: 'var(--bg)' }, lock);
  const shackle = svgEl('path', { d: 'M6 10 V6 a4 4 0 0 1 8 0 V10', fill: 'none', stroke: 'var(--bg)', 'stroke-width': 3 }, lock);
  const state = el('div', 'state', panel);
  const panelCap = el('div', 'figcap', cam);
  panelCap.innerHTML = `${S.text.panel}<small>${S.text.panelNote}</small>`;
  const nope = makeStamp(cam, S.text.nope, 'fill');

  // FIG. 10B, the print, filling red from the bottom as the scan climbs it.
  const size = L.print.size * st.u;
  const print = svgEl('svg', { class: 'print' }, cam);
  const clip = svgEl('clipPath', { id: 'scan-clip' }, svgEl('defs', {}, print));
  const clipRect = svgEl('rect', { x: -size, width: size * 2 }, clip);
  const base = svgEl('g', { fill: 'none', stroke: 'var(--line-strong)', 'stroke-width': size * 0.028, 'stroke-linecap': 'round' }, print);
  const lit = svgEl('g', { fill: 'none', stroke: 'var(--red)', 'stroke-width': size * 0.028, 'stroke-linecap': 'round', 'clip-path': 'url(#scan-clip)' }, print);
  for (const d of printPaths(size)) {
    svgEl('path', { d }, base);
    svgEl('path', { d }, lit);
  }
  const line = svgEl('rect', { x: -size * 0.6, width: size * 1.2, height: size * 0.018, fill: 'var(--amber)' }, print);
  // The whorl, inside the innermost ridge: where the camera goes.
  const whorl = svgEl('circle', { cx: 0, cy: size * 0.05, r: size * 0.075, fill: 'none' }, print);
  const printCap = el('div', 'figcap', cam);
  printCap.innerHTML = `${S.text.print}<small>${S.text.finger}</small>`;

  const unit = makeUnit(cam, L.unit.size * st.u);

  return {
    el: root,
    dive: S.beats - S.at.dive,
    portal: () => ({ el: whorl, shape: 'circle', angle: 360 }),
    sky: (t) => ({ gx: 0.5, gy: 0.55, grid: 0.55, glow: 0.35 + 0.6 * hit(t, S.at.armed, 2), glowX: L.print.x / st.W, glowY: L.print.y / st.H, glowR: 50, dy: -t }),
    frame(t) {
      // The page: printed already.
      place(head, st, { x: L.head[0], y: L.head[1], ax: 0, ay: 0.5, r: -2.5 });
      place(intro, st, { x: L.intro.x, y: L.intro.y, ax: 0, ay: 0.5 });

      // The panel, the switch locked until armed.
      const armed = seg(t, S.at.armed, S.at.armed + 0.3, outBack(2));
      place(panel, st, { x: L.panel.x, y: L.panel.y });
      place(panelCap, st, { x: L.panel.x - panel.offsetWidth / st.u / 2, y: L.panel.y + panel.offsetHeight / st.u / 2 + 2, ax: 0, ay: 0 });
      knob.style.transform = `translateX(${(armed * 8 * st.u).toFixed(1)}px)`;
      sw.style.background = t >= S.at.armed ? 'var(--red)' : '';
      sw.style.boxShadow = t >= S.at.armed ? `0 0 ${3 * st.u}px var(--red)` : '';
      shackle.setAttribute('d', t >= S.at.armed ? 'M6 10 V6 a4 4 0 0 1 8 0 V4' : 'M6 10 V6 a4 4 0 0 1 8 0 V10');
      const label = t >= S.at.armed ? S.text.armed : 'Locked';
      if (state.textContent !== label) state.textContent = label;
      state.style.color = t >= S.at.armed ? 'var(--amber-ink)' : 'var(--red)';
      const bump = hit(t, S.at.reach, 10);
      sw.style.translate = `${(Math.sin(t * 90) * bump * 0.5 * st.u).toFixed(1)}px 0`;
      nope.style.display = t >= S.at.nope - 0.15 && t < S.at.scan ? '' : 'none';
      stampAt(nope, st, t, S.at.nope, L.nope[0], L.nope[1], -12, 1.3);

      // The scan: a line climbing the print, the red filling in behind it.
      const scan = seg(t, S.at.scan, S.at.scanned, inOutCubic);
      const top = size * 0.62;
      const y = lerp(top, -top, scan);
      clipRect.setAttribute('y', y.toFixed(1));
      clipRect.setAttribute('height', (top - y + 2).toFixed(1));
      line.setAttribute('y', y.toFixed(1));
      line.style.opacity = t >= S.at.scan && t < S.at.scanned + 0.1 ? '1' : '0';
      place(print, st, { x: L.print.x, y: L.print.y, ax: 0, ay: 0, s: (t < S.at.scan ? 0.92 : 1) * (1 + 0.08 * hit(t, S.at.armed, 6)), o: 0.55 + 0.45 * seg(t, S.at.scan - 0.3, S.at.scan) });
      place(printCap, st, { x: L.print.x - L.print.size * 0.42, y: L.print.y + L.print.size * 0.74, ax: 0, ay: 0 });

      // A-01: tiptoes over side on, bumps the switch, jumps back, blushes.
      const sneak = seg(t, S.at.sneak, S.at.reach, inOutCubic);
      const back = seg(t, S.at.nope, S.at.nope + 0.4, outCubic);
      const steps = [0, 1, 2].map((k) => hop(t, S.at.sneak + k * 0.5, 0.35, 0.12, 0.05));
      const step = steps.find((s) => s.lift > 0) ?? steps.reduce((a, b) => (Math.abs(b.sy - 1) > Math.abs(a.sy - 1) ? b : a));
      const recoil = hop(t, S.at.nope, 0.4, 0.5, 0.02);
      const joy = hop(t, S.at.armed + 0.1, 0.45, 0.6, 0.12);
      const x = lerp(L.unit.from, L.unit.to, sneak) - back * 8;
      const sneaking = t >= S.at.sneak && t < S.at.nope;
      const ashamed = t >= S.at.nope && t < S.at.armed;
      place(unit.el, st, { x, y: L.unit.y, r: bump * 6 });
      unit.draw(lookOf(ashamed ? 'shy' : 'plain'), {
        facing: sneaking ? 'side' : 'front',
        toward: 1,
        eyes: t >= S.at.armed ? 'happy' : t >= S.at.nope ? (t < S.at.nope + 0.5 ? 'wide' : 'sleepy') : sneaking ? 'dot' : blinking(t, 6) ? 'shut' : 'dot',
        gaze: t >= S.at.scan && t < S.at.armed ? [0.8, 0] : [0.3, 0],
        sx: step.sx * recoil.sx * joy.sx,
        sy: step.sy * recoil.sy * joy.sy,
        lift: step.lift + recoil.lift + joy.lift,
        shadow: 0.5,
      });
    },
  };
}
