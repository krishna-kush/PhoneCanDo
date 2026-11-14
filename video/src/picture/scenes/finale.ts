// The last drop and the landing (reel.ts and end.ts on the timeline): the
// site's headline with its verb a slot reel landing on every beat, A-01 on
// top in each verb's costume; the reel spins out and lands on `use`; then
// the end card: the mark, the address on the site's red button, A-01 (in
// the Shift lead's gear it earns in the app) stamping on the button; and
// the camera pulls out to find it all on a phone on the manual's cover.

import logo from '../../../../theme/logo.json' with { type: 'json' };
import { inOutCubic, outBack, outCubic } from '../../motion/ease.ts';
import { hash } from '../../motion/noise.ts';
import { clamp, hit, lerp, pulse, seg } from '../../motion/tween.ts';
import { end as E } from '../../timeline/script/end.ts';
import { reel as R } from '../../timeline/script/reel.ts';
import { el, place, svgEl } from '../el.ts';
import { bubbleAt, makeBubble } from '../parts/bubble.ts';
import { makeBurst } from '../parts/burst.ts';
import { typeOn } from '../parts/words.ts';
import { byShape, type Stage } from '../stage.ts';
import { lookOf, makeUnit } from '../unit/draw.ts';
import { blinking, bob, hop } from '../unit/moves.ts';
import { makeCover } from './cover.ts';
import type { Ctx, View } from './scene.ts';

type Layout = {
  head: { x: number; y: number; font: number };
  end: { y: number; s: number };
  mark: number;
  btn: number;
  notes: number;
  unit: number;
};

const layout = (st: Stage): Layout =>
  byShape<Layout>(
    st,
    { head: { x: 13, y: 52, font: 17 }, end: { y: 20, s: 0.55 }, mark: 38, btn: 72, notes: 86, unit: 15 },
    { head: { x: 7, y: 76, font: 15.5 }, end: { y: 34, s: 0.7 }, mark: 62, btn: 101, notes: 115, unit: 15 },
    { head: { x: 7, y: 52, font: 12.5 }, end: { y: 17, s: 0.5 }, mark: 36, btn: 70, notes: 84, unit: 11 },
  );

/** Every verb the reel shows, the last one where it stops. */
const VERBS = [...R.verbs.map((v) => v.verb), E.text.verb];
const DESIGN = [...R.verbs.map((v) => v.design), E.design];

export function makeFinale(ctx: Ctx): { reel: View; end: View } {
  const { st } = ctx;
  const L = layout(st);
  const root = el('div', '');
  const cam = el('div', 'layer', root);

  // The headline, its verb on the reel; tall and square give the verb its own line.
  const head = el('div', 'pin head reelhead', cam);
  head.style.fontSize = `${L.head.font * st.u}px`;
  el('span', '', head, `${R.text.pre} `);
  if (st.shape !== 'wide') el('br', '', head);
  const verb = el('span', 'verb', head, VERBS[0]);
  el('br', '', head);
  el('span', '', head, R.text.post);
  const squiggle = svgEl('svg', { class: 'draw' }, cam);
  const wave = svgEl('path', { fill: 'none', stroke: 'var(--amber)', 'stroke-width': 0.9 * st.u, 'stroke-linecap': 'round' }, squiggle);

  // The end card: the mark, the button with the address, the notes.
  const row = el('div', 'pin endrow', cam);
  const mark = el('div', 'mark', row);
  const ms = 8 * st.u;
  mark.style.cssText += `width:${ms}px;height:${ms}px;box-shadow:${ms * logo.shadow.ratio}px ${ms * logo.shadow.ratio}px 0 var(--amber);`;
  el('div', 'wordmark', row, 'phonecando');
  const btn = el('div', 'btn endbtn', cam);
  const url = el('span', 'url', btn);
  const arrow = svgEl('svg', { class: 'arrow', viewBox: '0 0 12 12' }, btn);
  svgEl('path', { d: 'M1 6h9M6.5 2.5 10 6l-3.5 3.5', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.6, 'stroke-linecap': 'square' }, arrow);
  const notes = el('div', 'pin notes', cam);
  const noteEls = E.text.notes.map((n) => el('span', '', notes, n));
  const bye = makeBubble(cam, E.text.bye);

  const unit = makeUnit(cam, L.unit * st.u);
  const burst = makeBurst(cam, st);

  let squiggleFor = '';
  let btnW = 0;

  /** Which verb is up at [t] (on this picture's beat line), whether it's rolling, and when it landed. */
  const reelAt = (t: number): { text: string; rolling: boolean; landed: number; i: number } => {
    if (t >= R.beats) return { text: VERBS[VERBS.length - 1], rolling: false, landed: R.beats, i: VERBS.length - 1 };
    if (t >= R.at.spin) return { text: VERBS[Math.floor(hash(Math.floor(t * 16), 5) * VERBS.length)], rolling: true, landed: R.at.spin, i: VERBS.length - 2 };
    const i = clamp(Math.floor(t + 0.375), 0, R.verbs.length - 1);
    if (t < i) return { text: VERBS[(i + 3 + Math.floor(t * 8)) % VERBS.length], rolling: true, landed: i - 1, i: i - 1 };
    return { text: VERBS[i], rolling: false, landed: i, i };
  };

  const frame = (t: number) => {
    const e = t - R.beats;
    const r = reelAt(t);
    if (verb.textContent !== r.text) verb.textContent = r.text;
    const land = seg(t, r.landed, r.landed + 0.45);
    // The site's landing (VerbReel.astro): dropped in tall, squashed, settled.
    const dy = r.rolling ? -0.32 + 0.32 * ((t * 8) % 1) : land < 0.55 ? lerp(-0.42, 0.06, land / 0.55) : lerp(0.06, 0, (land - 0.55) / 0.45);
    const sy = r.rolling ? 1 : land < 0.55 ? lerp(1.12, 0.94, land / 0.55) : lerp(0.94, 1, (land - 0.55) / 0.45);
    verb.style.transform = `translateY(${dy.toFixed(3)}em) scale(${(2 - sy).toFixed(3)}, ${sy.toFixed(3)})`;
    verb.style.filter = r.rolling ? `blur(${(0.25 * st.u).toFixed(1)}px)` : '';
    verb.style.opacity = r.rolling ? '0.6' : '1';

    // The headline: dancing on the drop, then up and smaller for the end card.
    const up = seg(e, E.at.mark - 0.25, E.at.mark + 0.35, inOutCubic);
    const y = lerp(L.head.y, L.end.y, up);
    const s = lerp(1, L.end.s, up) * (1 + 0.015 * pulse(t, 6) * (1 - up));
    const ax = 0.5 * up;
    const hx = lerp(L.head.x, st.W / 2, up);
    place(head, st, { x: hx, y, ax, ay: 0.5, s });

    // Where the verb sits now, in u, for the squiggle and A-01.
    const hh = head.offsetHeight / st.u;
    const vx = hx - ax * (head.offsetWidth / st.u) * s + (verb.offsetLeft / st.u) * s;
    const vy = y - (hh * s) / 2 + (verb.offsetTop / st.u) * s;
    const vw = (verb.offsetWidth / st.u) * s;
    const vh = (verb.offsetHeight / st.u) * s;

    // The squiggle, drawn under each verb as it lands.
    if (!r.rolling && squiggleFor !== `${r.text}:${s.toFixed(2)}`) {
      squiggleFor = `${r.text}:${s.toFixed(2)}`;
      const w = vw * st.u;
      let d = 'M0 0';
      const n = Math.max(3, Math.round(vw / 4));
      for (let k = 1; k <= n * 2; k++) d += ` Q${((k - 0.5) * w) / (n * 2)} ${(k % 2 ? -0.9 : 0.9) * st.u * s} ${(k * w) / (n * 2)} 0`;
      wave.setAttribute('d', d);
      wave.setAttribute('stroke-width', String(0.9 * st.u * s));
      wave.style.strokeDasharray = String(wave.getTotalLength());
    }
    const total = Number(wave.style.strokeDasharray) || 1;
    const drawn = r.rolling ? 0 : seg(t, r.landed + 0.05, r.landed + (e >= 0 ? 0.45 : 0.25), outCubic);
    wave.style.strokeDashoffset = String(total * (1 - drawn));
    squiggle.style.transform = `translate(${(vx * st.u).toFixed(1)}px, ${((vy + vh * 0.95) * st.u).toFixed(1)}px)`;

    // The end card coming in under the headline.
    const rowIn = seg(e, E.at.mark, E.at.mark + 0.35, outBack(1.8));
    place(row, st, { x: st.W / 2, y: L.mark, s: rowIn, o: clamp(rowIn * 2) });
    if (!btnW) {
      url.textContent = E.text.url;
      btnW = btn.offsetWidth;
      btn.style.minWidth = `${btnW}px`;
    }
    typeOn(url, E.text.url, e, E.at.url, E.at.key);
    const btnIn = seg(e, E.at.url - 0.2, E.at.url + 0.1, outBack(2));
    const press = hit(e, E.at.press, 6) * (e >= E.at.press ? 1 : 0);
    btn.style.setProperty('--press', `${((1 - press) * 1.1 * st.u).toFixed(1)}px`);
    place(btn, st, { x: st.W / 2 + press * 1.1, y: L.btn + press * 1.1, s: btnIn, o: e < E.at.url - 0.2 ? 0 : 1 });
    place(notes, st, { x: st.W / 2, y: L.notes });
    noteEls.forEach((n, k) => {
      const at = E.at.notes + k * 0.15;
      const ok = seg(e, at, at + 0.3, outCubic);
      n.style.opacity = String(ok);
      n.style.transform = `translateY(${((1 - ok) * 1.5 * st.u).toFixed(1)}px)`;
    });

    // A-01: on the verb through the reel, then over to the button and onto it.
    const bw = btnW / st.u;
    const bh = btn.offsetHeight / st.u;
    const onBtn: [number, number] = [st.W / 2 + bw * 0.3 + press * 1.1, L.btn - bh / 2 + press * 1.1];
    // Wide, on top of the verb; tall and square give it a line of its own,
    // so beside it, small enough to keep off the lines round it.
    const small = st.shape === 'wide' ? 1 : 0.62;
    const onVerb: [number, number] = st.shape === 'wide' ? [vx + vw / 2, vy + vh * 0.1] : [vx + vw + L.unit * small * 0.75 + 1.5, vy + vh * 0.86];
    const over = seg(e, E.at.mark, E.at.mark + 0.6);
    const ux = lerp(onVerb[0], onBtn[0], inOutCubic(over));
    const uy = lerp(onVerb[1], onBtn[1], over) - 4 * 14 * over * (1 - over);
    const groove = e < 0 ? bob(t, 0.12) : bob(t, 0.04);
    const stomp = hop(e, E.at.press - 0.45, 0.45, 0.8, 0.15);
    const wave_ = hop(e, E.at.bye, 0.4, 0.5, 0.12);
    const landed = hit(t, r.landed, 9) * (r.rolling ? 0 : 1);
    const flying = over > 0 && over < 1;
    const us = lerp(small, 1, inOutCubic(over));
    place(unit.el, st, { x: ux, y: uy, r: flying ? over * 360 : 0, s: us });
    unit.draw(lookOf(DESIGN[Math.max(0, r.i)]), {
      eyes: r.rolling ? 'wide' : e >= E.at.bye ? 'happy' : blinking(t, 8) ? 'shut' : landed > 0.3 ? 'wide' : 'dot',
      gaze: e > E.at.notes ? [0, 0.2] : [0.4, 0.1],
      sx: (flying ? 0.92 : 1) * groove.sx * stomp.sx * wave_.sx * (1 + 0.2 * landed),
      sy: (flying ? 1.1 : 1) * groove.sy * stomp.sy * wave_.sy * (1 - 0.25 * landed),
      lift: (flying ? 0 : groove.lift) + stomp.lift + wave_.lift,
      shadow: flying ? 0 : 0.5,
    });
    burst.draw(t, r.rolling ? -10 : r.landed, ux, uy - L.unit * us * 0.6, L.unit * us * 0.9);
    bubbleAt(bye, st, e, E.at.bye, E.beats + 1, onBtn[0] + L.unit * 0.45, onBtn[1] - L.unit * 1.05);
  };

  const sky = (t: number) => {
    const e = t - R.beats;
    return { gx: 0.35, gy: 0.5, dx: -t * 2.5, glow: 0.8 + 0.5 * hit(t, 0, 3) + 0.6 * hit(e, 0, 3) + 0.25 * pulse(t, 5) * (e < 0 ? 1 : 0.3), glowX: 0.3, glowY: 0.5, glowR: 85, zoom: 1 + 0.02 * pulse(t, 5) * (e < 0 ? 1 : 0) };
  };

  return {
    reel: { el: root, frame, sky },
    end: { el: root, frame: (t) => frame(t + R.beats), sky: (t) => sky(t + R.beats), pull: { view: makeCover(ctx), at: E.at.pull, len: E.at.still - E.at.pull } },
  };
}
