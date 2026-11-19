// Run one, or a whole crew (crew.ts on the timeline): FIG. 08's live photo,
// A-01 alone, then its colleagues popping in for a team photo; a note A-01
// passes down the crew over their heads, everyone watching it go, hops
// taken in turn, and night falling on an
// all-nighter, the moon up. Then the stage crew lets the next scene down
// over them from the flies.

import { inOutCubic, outBack } from '../../../../engine/motion/ease.ts';
import { noise } from '../../../../engine/motion/noise.ts';
import { lerp, seg } from '../../../../engine/motion/tween.ts';
import { crew as S } from '../../script/crew.ts';
import { el, place } from '../el.ts';
import { makeBurst } from '../parts/burst.ts';
import { makeNote, type Hand } from '../parts/note.ts';
import { leave, makeWords, rise, type Words } from '../parts/words.ts';
import { makeFly } from '../stagehands/fly.ts';
import { byShape, type Stage } from '../stage.ts';
import { stretchOf, type Shape } from '../../../../../mascot/body.ts';
import { BODY, lookOf, makeUnit, type Unit } from '../unit/draw.ts';
import { blinking, bob, hop, type Squash } from '../unit/moves.ts';
import type { Ctx, View } from './scene.ts';

/** [via] is the seat the note goes through on its way from A-01 to the far end of the front row. */
type Layout = { rows: number[]; size: number; gap: number; stagger: number; grounds: number[]; head: number; font: number; moon: [number, number]; via: number };

const layout = (st: Stage): Layout =>
  byShape<Layout>(
    st,
    { rows: [6, 6], size: 13, gap: 23, stagger: 0.25, grounds: [62, 86], head: 22, font: 11, moon: [150, 22], via: 1 },
    { rows: [4, 4, 4], size: 13, gap: 21, stagger: 0.1, grounds: [96, 121, 146], head: 40, font: 11.5, moon: [78, 22], via: 0 },
    { rows: [6, 6], size: 9.5, gap: 15.5, stagger: 0.2, grounds: [66, 87], head: 24, font: 8.5, moon: [84, 15], via: 1 },
  );

/** The phrases, each from its moment until the next's. */
const LINES: [string, number][] = [
  ['Run *one.*', S.at.one],
  ['Or a whole *crew.*', S.at.crew],
  ['Pass *notes.*', S.at.notes],
  ['Take *turns.*', S.at.turns],
  ['Pull *all-nighters.*', S.at.nights],
];

/** When the note lands in each hand after the first. */
const landOf = (k: number) => S.note.throws[k] + S.note.flight;

type Seat = { unit: Unit; x: number; y: number; size: number; design: string; shape: Shape; swap: boolean; at: number; rank: number };

/** Shapes for the crew, round the lineup, so no two neighbours match. */
const SHAPES: Shape[] = ['tall', 'wide', 'square', 'taller', 'wide', 'tall', 'square', 'wider', 'tall', 'wide', 'square'];

export function makeCrew({ st }: Ctx): View {
  const L = layout(st);
  const root = el('div', '');
  const cam = el('div', 'layer', root);

  const moon = el('div', 'moon', cam);
  const ms = 9 * st.u;
  moon.style.width = moon.style.height = `${ms}px`;
  const bite = el('i', '', moon);
  bite.style.cssText = `width:${ms}px;height:${ms}px;left:${ms * 0.32}px;top:${-ms * 0.18}px;`;

  // Seats: back rows first, so the front row draws over them.
  const seats: Seat[] = [];
  const designs = ['plain', ...S.designs];
  const order: [number, number][] = [];
  L.rows.forEach((count, r) => {
    for (let j = 0; j < count; j++) order.push([r, j]);
  });
  // A-01 takes the front row's middle; the rest fill in round it.
  const front = L.rows.length - 1;
  const mid = Math.floor((L.rows[front] - 1) / 2);
  const a01 = order.findIndex(([r, j]) => r === front && j === mid);
  let next = 0;
  order.forEach(([r, j], i) => {
    const count = L.rows[r];
    const x = st.W / 2 + (j - (count - 1) / 2) * L.gap + (r % 2 ? 1 : -1) * L.gap * L.stagger;
    const y = L.grounds[r];
    const size = L.size * (1 - 0.06 * (front - r));
    const design = i === a01 ? 'plain' : designs[1 + next++];
    const joined = i === a01 ? -1 : S.at.join + (next - 1) * S.at.step;
    const shape: Shape = i === a01 ? 'square' : SHAPES[(next - 1) % SHAPES.length];
    seats.push({ unit: makeUnit(cam, size * st.u), x, y, size, design: design ?? 'plain', shape, swap: i !== a01 && next % 3 === 0, at: joined, rank: i });
  });
  const bursts = seats.map(() => makeBurst(cam, st));
  // The note's way: A-01, up to the back row, then across to the far end of the front.
  const chain = [a01, L.via, seats.length - 1];
  const note = makeNote(cam, st, { ...S.note, end: S.at.turns - 0.15, top: L.head + L.font * 0.6 + 7 });
  /** A hand on the note's way: a toss as it throws, a jump up to meet it as it catches. */
  const passing = (c: number, t: number): Squash => {
    const parts: Squash[] = [];
    if (c > 0) parts.push(hop(t, landOf(c - 1) - 0.2, 0.4, 0.18, 0.1));
    if (c < chain.length - 1) parts.push(hop(t, S.note.throws[c], 0.3, 0.08, 0.15));
    return parts.reduce((a, b) => ({ lift: a.lift + b.lift, sx: a.sx * b.sx, sy: a.sy * b.sy }), { lift: 0, sx: 1, sy: 1 });
  };
  /** Whether a hand on the note's way is pleased with itself: just thrown, or just caught. */
  const pleased = (c: number, t: number) =>
    (c < chain.length - 1 && t >= S.note.throws[c] && t < S.note.throws[c] + 0.6) || (c > 0 && t >= landOf(c - 1) && t < (c === chain.length - 1 ? S.at.turns : landOf(c - 1) + 0.5));
  const zs = [0, 1, 2].map(() => el('div', 'zzz', cam, 'z'));

  const lines: Words[] = LINES.map(([text]) => {
    const w = makeWords(cam, text);
    w.el.classList.add('pin');
    w.el.style.fontSize = `${L.font * st.u}px`;
    w.el.style.whiteSpace = 'nowrap';
    return w;
  });

  return {
    el: root,
    gag: makeFly(st, { from: S.at.fly, end: S.beats }),
    sky: (t) => ({
      gy: 0.65,
      dx: t * 1.5,
      glow: 0.7 - 0.5 * seg(t, S.at.nights, S.at.nights + 0.6),
      glowY: 0.7,
      glowR: 90,
      night: seg(t, S.at.nights, S.at.nights + 0.6, inOutCubic),
      grid: 1 - 0.5 * seg(t, S.at.nights, S.at.nights + 0.6),
    }),
    frame(t) {
      const night = seg(t, S.at.nights, S.at.nights + 0.6, inOutCubic);

      // The phrases.
      lines.forEach((w, i) => {
        const [, at] = LINES[i];
        const until = LINES[i + 1]?.[1] ?? S.beats + 1;
        const on = t >= at - 0.01 && t < until + 0.3;
        w.el.style.display = on ? '' : 'none';
        if (!on) return;
        place(w.el, st, { x: st.W / 2, y: L.head });
        rise(w.words, t, at, 0.08, 0.3);
        leave(w.words, t, until - 0.15, 0.03, 0.2);
      });

      // The note over the hands on its way, for everyone to watch.
      const hands: Hand[] = chain.map((i, c) => {
        const s = seats[i];
        return { x: s.x, y: s.y - s.size * (stretchOf(s.shape, BODY).h + passing(c, t).lift) - 3.5 };
      });
      const watched = note.where(t, hands);
      const watch = watched?.x ?? null;
      note.draw(t, hands);

      // The moon rising on the all-nighter.
      place(moon, st, { x: L.moon[0], y: L.moon[1] + (1 - night) * 30, o: night });

      seats.forEach((s, i) => {
        const here = s.at < 0 || t >= s.at;
        s.unit.el.style.display = here ? '' : 'none';
        if (!here) return;
        // A-01 starts alone, bigger, in the middle, and steps into its seat.
        const into = s.at < 0 ? seg(t, S.at.join - 0.25, S.at.join + 0.35, inOutCubic) : 1;
        const x = s.at < 0 ? lerp(st.W / 2, s.x, into) : s.x;
        const y = s.at < 0 ? lerp(L.grounds[L.grounds.length - 1] + 2, s.y, into) : s.y;
        const big = s.at < 0 ? lerp(1.5, 1, into) : 1;
        const popIn = s.at < 0 ? 1 : seg(t, s.at, s.at + 0.3, outBack(2.4));
        const turn = Math.floor((s.rank * 7) % 4);
        const leap = hop(t, S.at.turns + turn * 0.5, 0.4, 0.55, 0.12);
        const c = chain.indexOf(i);
        const pass = c < 0 ? null : passing(c, t);
        const groove = night > 0 ? bob(t * 0.5, 0.03) : bob(t + (i % 2) * 0.5, 0.04);
        const gx = watch === null ? noise(t * 0.7, i) * 0.6 : Math.max(-1, Math.min(1, (watch - x) / 25));
        const eyes = night > 0.5 ? (blinking(t, i, 1.6) ? 'shut' : 'sleepy') : t < s.at + 0.35 ? 'wide' : (c >= 0 && pleased(c, t)) || leap.lift > 0 ? 'happy' : blinking(t, i + 9) ? 'shut' : 'dot';
        place(s.unit.el, st, { x, y, s: popIn * big });
        s.unit.draw(lookOf(s.design, s.shape, s.swap), {
          eyes,
          gaze: [gx, watched ? Math.max(-1, Math.min(0.2, (watched.y - (y - s.size)) / 15)) : 0.1],
          sx: leap.sx * groove.sx * (pass?.sx ?? 1),
          sy: leap.sy * groove.sy * (pass?.sy ?? 1),
          lift: leap.lift + groove.lift + (pass?.lift ?? 0),
          shadow: 0.5,
        });
        bursts[i].draw(t, s.at, x, y - s.size * 0.55, s.size * 0.9);
      });

      // Zs drifting up off three sleepers.
      zs.forEach((z, k) => {
        const s = seats[[1, 4, 9][k] % seats.length];
        const cycle = ((t - S.at.nights - k * 0.4) % 1.6) / 1.6;
        const on = t > S.at.nights + 0.3 + k * 0.4;
        place(z, st, { x: s.x + s.size * 0.4 + cycle * 4, y: s.y - s.size * 1.3 - cycle * 9, o: on ? Math.sin(cycle * Math.PI) : 0, s: 0.7 + cycle * 0.6 });
      });
    },
  };
}
