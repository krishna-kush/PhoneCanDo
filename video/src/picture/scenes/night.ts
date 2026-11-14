// Schedules (night.ts on the timeline), inside the crew's moon: A-01 in its
// night-watch beanie sets a task for the morning, the clock races through
// the night under the stars, the sun comes up, and the list is already
// done. Then the crew's magician makes the set vanish under a cloth.

import { inOutCubic, outBack, outCubic } from '../../motion/ease.ts';
import { hash } from '../../motion/noise.ts';
import { clamp, lerp, seg } from '../../motion/tween.ts';
import { night as S } from '../../timeline/script/night.ts';
import { el, place } from '../el.ts';
import { leave, makeWords, rise, typeOn } from '../parts/words.ts';
import { makeCloth } from '../stagehands/cloth.ts';
import { byShape, type Stage } from '../stage.ts';
import { lookOf, makeUnit } from '../unit/draw.ts';
import { blinking, bob, hop } from '../unit/moves.ts';
import type { Ctx, View } from './scene.ts';

type Layout = { head: number; font: number; card: { x: number; y: number; w: number }; unit: { x: number; y: number; size: number }; sun: [number, number] };

const layout = (st: Stage): Layout =>
  byShape<Layout>(
    st,
    { head: 20, font: 11, card: { x: 112, y: 60, w: 74 }, unit: { x: 46, y: 84, size: 25 }, sun: [154, 30] },
    { head: 26, font: 11.5, card: { x: 50, y: 82, w: 86 }, unit: { x: 50, y: 150, size: 22 }, sun: [82, 52] },
    { head: 15, font: 8.5, card: { x: 61, y: 59, w: 66 }, unit: { x: 15, y: 86, size: 14 }, sun: [86, 24] },
  );

/** Minutes past midnight, as the clock reads them. */
const hhmm = (m: number) => {
  const d = ((Math.round(m) % 1440) + 1440) % 1440;
  return `${String(Math.floor(d / 60)).padStart(2, '0')}:${String(d % 60).padStart(2, '0')}`;
};

export function makeNight({ st }: Ctx): View {
  const L = layout(st);
  const root = el('div', '');
  const cam = el('div', 'layer', root);

  const stars = Array.from({ length: 18 }, (_, i) => {
    const s = el('div', 'star', cam);
    return { s, x: hash(i, 1) * st.W, y: hash(i, 2) * st.H * 0.55 + 4, tw: hash(i, 3) * 6 };
  });
  const sun = el('div', 'sun', cam);
  sun.style.width = sun.style.height = `${16 * st.u}px`;

  const tonight = makeWords(cam, 'Set it *tonight.*');
  const done = makeWords(cam, 'Wake up to *done.*');
  for (const w of [tonight, done]) {
    w.el.classList.add('pin');
    w.el.style.fontSize = `${L.font * st.u}px`;
    w.el.style.whiteSpace = 'nowrap';
  }

  const card = el('div', 'sched', cam);
  card.style.width = `${L.card.w * st.u}px`;
  const when = el('div', 'label amber', card);
  const clock = el('div', 'clock', card);
  const tasks = S.text.tasks.map((text) => {
    const row = el('div', 'task', card);
    const box = el('i', '', row);
    el('span', '', row, text);
    const stamp = el('b', '', row, 'Done');
    return { row, box, stamp };
  });
  const unit = makeUnit(cam, L.unit.size * st.u);

  const from = 23 * 60;
  const to = 7 * 60 + 24 * 60;

  return {
    el: root,
    gag: makeCloth(st, { from: S.at.act, sweep: S.at.sweep, tada: S.at.tada, end: S.beats }),
    sky: (t) => {
      const day = seg(t, S.at.sunrise - 0.3, S.at.sunrise + 0.7, inOutCubic);
      return { night: 1 - day, dawn: day, glow: 0.2 + 0.4 * day, glowX: L.sun[0] / st.W, glowY: L.sun[1] / st.H, glowR: 90, grid: 0.5 + 0.5 * day, dy: -t * 1.2 };
    },
    frame(t) {
      const day = seg(t, S.at.sunrise - 0.3, S.at.sunrise + 0.7, inOutCubic);
      const spin = seg(t, S.at.spin, S.at.spun, inOutCubic);

      stars.forEach(({ s, x, y, tw }) => place(s, st, { x, y, o: (1 - day) * (0.35 + 0.65 * Math.abs(Math.sin(t * 2 + tw))) }));
      place(sun, st, { x: L.sun[0], y: L.sun[1] + (1 - seg(t, S.at.sunrise - 0.2, S.at.sunrise + 0.9, outCubic)) * 40, o: day });

      place(tonight.el, st, { x: st.W / 2, y: L.head });
      rise(tonight.words, t, S.at.tonight, 0.1);
      leave(tonight.words, t, S.at.done - 0.3, 0.03, 0.2);
      tonight.el.style.display = t < S.at.done ? '' : 'none';
      place(done.el, st, { x: st.W / 2, y: L.head });
      rise(done.words, t, S.at.done, 0.1);
      done.el.style.display = t >= S.at.done - 0.05 ? '' : 'none';

      // The card: in, then the clock racing from tonight to the morning.
      const cardIn = seg(t, 0.2, 0.6, outBack(1.6));
      place(card, st, { x: L.card.x, y: L.card.y, s: cardIn, r: (1 - cardIn) * 6 });
      typeOn(when, `Schedule · ${S.text.when}`, t, 0.3, 0.015);
      const m = lerp(from, to, spin);
      const shown = `${hhmm(m)}<small>${t >= S.at.sunrise ? 'Wake up' : t >= S.at.set ? 'Set' : 'Tonight'}</small>`;
      if (clock.dataset.k !== shown) clock.innerHTML = clock.dataset.k = shown;
      tasks.forEach((task, i) => {
        const at = S.at.checks + i * S.at.check;
        const on = t >= at;
        task.box.classList.toggle('on', on);
        task.row.classList.toggle('on', on);
        const k = seg(t, at - 0.1, at, outCubic);
        task.stamp.style.opacity = String(clamp(k * 2));
        task.stamp.style.transform = `rotate(-8deg) scale(${(on ? 1 : 2.2 - 1.2 * k).toFixed(3)})`;
      });

      // A-01: sets it, dozes through the night, wakes with the sun.
      const press = hop(t, S.at.set - 0.05, 0.3, 0.2, 0.1);
      const wake = hop(t, S.at.sunrise + 0.1, 0.45, 0.6, 0.15);
      const groove = day > 0.5 ? bob(t, 0.05) : bob(t * 0.5, 0.02);
      const eyes = t < S.at.spin ? (blinking(t, 4) ? 'shut' : 'dot') : t < S.at.sunrise ? 'shut' : t < S.at.sunrise + 0.6 ? 'wide' : 'happy';
      place(unit.el, st, { x: L.unit.x, y: L.unit.y });
      unit.draw(lookOf('watch'), {
        eyes,
        gaze: t < S.at.spin ? [0.6, -0.2] : [0, 0],
        sx: press.sx * wake.sx * groove.sx,
        sy: press.sy * wake.sy * groove.sy,
        lift: press.lift + wake.lift + groove.lift,
        shadow: 0.5,
      });
    },
  };
}
