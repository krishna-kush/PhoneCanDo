// On the device (stamps.ts on the timeline), inside the fingerprint's
// whorl: three stamps slammed on three beats, the site's promise under
// them; then the stage crew's curtain swishes shut for half a beat of held
// breath and is yanked open on the last drop.

import { inQuad, outCubic } from '../../motion/ease.ts';
import { seg } from '../../motion/tween.ts';
import { stamps as S } from '../../timeline/script/stamps.ts';
import { el, place } from '../el.ts';
import { makeStamp, stampAt } from '../parts/stamp.ts';
import { makeCurtain } from '../stagehands/curtain.ts';
import { byShape, type Stage } from '../stage.ts';
import type { Ctx, View } from './scene.ts';

type Layout = { spots: [number, number, number][]; size: number; promise: number; font: number };

const layout = (st: Stage): Layout =>
  byShape<Layout>(
    st,
    { spots: [[60, 30, -7], [100, 50, 4], [88, 70, -3]], size: 1.9, promise: 88, font: 5.5 },
    { spots: [[42, 58, -7], [56, 80, 4], [50, 102, -3]], size: 1.55, promise: 124, font: 4.6 },
    { spots: [[40, 30, -7], [58, 50, 4], [50, 70, -3]], size: 1.3, promise: 88, font: 3.9 },
  );

export function makeStamps({ st }: Ctx): View {
  const L = layout(st);
  const root = el('div', '');
  const cam = el('div', 'layer', root);
  const stamps = S.text.stamps.map((text, i) => makeStamp(cam, text, i === 1 ? 'amber' : i === 2 ? 'fg' : 'red'));
  const promise = el('div', 'pin promise', cam);
  promise.style.fontSize = `${L.font * st.u}px`;
  const [keys, data, device] = S.text.keys.split(', ');
  promise.innerHTML = `<b>${keys},</b> ${data}, <b>${device}</b>`;

  return {
    el: root,
    gag: makeCurtain(st, { from: S.at.curtain, shut: S.at.gap, drop: S.at.crew, end: S.beats }),
    sky: (t) => ({ grid: 0.8, glow: 0.5 + 0.4 * seg(t, 0, S.at.gap), glowR: 70 + 20 * seg(t, 0, S.at.gap), zoom: 1 + 0.06 * seg(t, 0, S.at.gap) }),
    frame(t) {
      // Creeping in, the tension before the drop.
      const creep = seg(t, 0, S.at.gap, inQuad);
      cam.style.transformOrigin = '50% 50%';
      cam.style.transform = `scale(${(1 + 0.08 * creep).toFixed(4)})`;
      stamps.forEach((s, i) => {
        const [x, y, r] = L.spots[i];
        stampAt(s, st, t, S.at.stamps + i * S.at.step, x, y, r, L.size);
      });
      const k = seg(t, S.at.keys, S.at.keys + 0.4, outCubic);
      place(promise, st, { x: st.W / 2, y: L.promise + (1 - k) * 3, o: k });
    },
  };
}
