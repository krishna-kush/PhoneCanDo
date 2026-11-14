// The field manual's cover, where the camera pulls out to at the very end
// (end.ts on the timeline): the end card was a phone's screen all along,
// the phone lying sideways on the cover, the address stamped beside it,
// and the stage crew up along its foot for a curtain call.

import logo from '../../../../theme/logo.json' with { type: 'json' };
import { seg } from '../../motion/tween.ts';
import { end as E } from '../../timeline/script/end.ts';
import { el, place } from '../el.ts';
import { makePhone } from '../parts/phone.ts';
import { makeStamp, stampAt } from '../parts/stamp.ts';
import { makeCurtainCall, type Line } from '../stagehands/bow.ts';
import { byShape, type Stage } from '../stage.ts';
import type { Ctx, View } from './scene.ts';

type Layout = {
  label: [number, number];
  brand: { x: number; y: number; size: number };
  sub: [number, number];
  phone: { x: number; y: number; h: number };
  stamp: [number, number, number];
  crew: Line;
};

const layout = (st: Stage): Layout =>
  byShape<Layout>(
    st,
    { label: [12, 18], brand: { x: 12, y: 30, size: 9 }, sub: [12, 40], phone: { x: 122, y: 55, h: 76 }, stamp: [42, 60, 1.25], crew: { x: 16, y: 93, gap: 13.5, size: 8 } },
    { label: [8, 20], brand: { x: 8, y: 32, size: 8 }, sub: [8, 42], phone: { x: 50, y: 100, h: 80 }, stamp: [50, 150, 1.4], crew: { x: 14, y: 171, gap: 12, size: 7 } },
    { label: [8, 14], brand: { x: 8, y: 25, size: 7 }, sub: [8, 34], phone: { x: 60, y: 62, h: 66 }, stamp: [30, 84, 1.1], crew: { x: 14, y: 97, gap: 12, size: 6 } },
  );

/** The phone lies sideways, turned a little off square: its screen's frame sits turned this much. */
const TILT = 8;

export function makeCover({ st }: Ctx): View {
  const L = layout(st);
  const root = el('div', '');
  const cam = el('div', 'layer', root);

  const label = el('div', 'pin label amber', cam, E.text.manual);
  const brand = el('div', 'pin endrow', cam);
  const mark = el('div', 'mark', brand);
  const ms = L.brand.size * st.u;
  mark.style.cssText += `width:${ms}px;height:${ms}px;box-shadow:${ms * logo.shadow.ratio}px ${ms * logo.shadow.ratio}px 0 var(--amber);`;
  const word = el('div', 'wordmark', brand, 'phonecando');
  word.style.fontSize = `${ms}px`;
  const sub = el('div', 'pin page-intro', cam, E.text.cover);
  const phone = makePhone(cam, st, L.phone.h);
  const stamp = makeStamp(cam, E.text.url, 'fill');
  const call = makeCurtainCall(cam, st, { from: E.at.call, bow: E.at.bow }, L.crew);

  return {
    el: root,
    portal: () => ({ el: phone.screen, shape: 'box', angle: TILT }),
    sky: (t) => ({ gx: L.phone.x / st.W, gy: 0.5, dy: -t * 0.4, glow: 0.45, glowX: L.phone.x / st.W, glowY: L.phone.y / st.H, glowR: 70 }),
    frame(t) {
      // Settled on the cover, a slow drift in while it holds.
      cam.style.transformOrigin = '50% 50%';
      cam.style.transform = `scale(${(1 + 0.025 * seg(t, E.at.still, E.beats)).toFixed(4)})`;
      place(label, st, { x: L.label[0], y: L.label[1], ax: 0, ay: 0.5 });
      place(brand, st, { x: L.brand.x, y: L.brand.y, ax: 0, ay: 0.5 });
      place(sub, st, { x: L.sub[0], y: L.sub[1], ax: 0, ay: 0.5 });
      place(phone.el, st, { x: L.phone.x, y: L.phone.y, r: TILT - 90 });
      const [sx, sy, size] = L.stamp;
      stampAt(stamp, st, t, E.at.stamp, sx, sy, -6, size);
      call(t);
    },
  };
}
