// Drawing the night on the roll (NightRoll.astro, RollLane.astro): each
// task's holes, then a played night's work, waits, stamps and dark, and on
// every frame what the line has reached. A frame writes only what changed,
// and bars draw in by clipping, never by width, so the line glides. DOM
// only; what happens is night.ts.

import { clock, span } from './clock';
import { NIGHT, duesOf, stateAt, type Dark, type Night, type Outcome, type Task } from './night';

export type LaneEls = { el: HTMLElement; tape: HTMLElement; doing?: string };

/** An element that shows, or grows, from one minute to another; `g` is how far it grew last frame. */
type Timed = { el: HTMLElement; from: number; to: number; g?: number };

/** A wait: its dashed line, and the tag at its start while it still waits. */
type Wait = Timed & { tag: HTMLElement };

export type Painted = {
  holes: Timed[];
  stamps: Timed[];
  grows: Timed[];
  waits: Wait[];
  /** The dark while you hold the power button: it grows with the line. */
  open?: Timed;
};

const at = (el: HTMLElement, m: number, w?: number) => {
  el.style.setProperty('--x', (m / NIGHT).toFixed(4));
  if (w != null) el.style.setProperty('--w', (Math.max(0, Math.min(w, NIGHT - m)) / NIGHT).toFixed(4));
};

const make = (tag: string, cls: string, text?: string) => {
  const el = document.createElement(tag);
  el.className = cls;
  if (text) el.textContent = text;
  return el;
};

const WEEKDAYS = 'mon,tue,wed,thu,fri';

/** "check the CI · every 2 h", "rebase on main · weekdays". */
function label(t: Task): string {
  const when = t.every ? `every ${span(t.every)}` : t.days ? (t.days.join() === WEEKDAYS ? 'weekdays' : t.days.join(' ')) : '';
  return [t.by === 'agent' ? `✎ ${t.text}` : t.text, when].filter(Boolean).join(' · ');
}

/**
 * Punches every task's holes; a day-only task that skips tonight gets a faint
 * one. A note already set by minute `t` shows without its pop.
 */
export function paintTasks(lanes: LaneEls[], tasks: Task[], eve: number, now: number, fresh?: string): Timed[] {
  for (const l of lanes) l.tape.querySelectorAll('.hole').forEach((h) => h.remove());
  const out: Timed[] = [];
  for (const t of tasks) {
    const lane = lanes[t.lane];
    if (!lane || lane.el.dataset.level === 'none') continue;
    const dues = duesOf(t, eve);
    const off = !dues.length && t.days ? [t.at] : [];
    [...dues, ...off].forEach((m, n) => {
      const hole = make('i', 'hole');
      hole.dataset.task = t.id;
      hole.dataset.by = t.by;
      hole.title = `${clock(m)} · ${t.text}${off.length ? ' · not tonight' : ''}`;
      at(hole, m);
      if (n === 0) hole.append(make('em', '', off.length ? `${label(t)} · not tonight` : label(t)));
      if (off.length) hole.dataset.off = '';
      if (t.setAt != null) hole.dataset.set = '';
      if (t.setAt != null && t.setAt <= now) quiet(hole);
      if (t.id === fresh) hole.dataset.fresh = '';
      lane.tape.append(hole);
      out.push({ el: hole, from: t.setAt ?? 0, to: NIGHT });
    });
  }
  return out;
}

const STAMP: Record<Outcome, string> = { started: 'Started', woke: 'Woke', restarted: 'Restarted', skipped: 'Skipped' };

/**
 * Draws what a night did: the work, the waits, the stamps and the dark. A
 * stamp already down by minute `now` shows without its thump; a dark still
 * open (to past the night) is drawn as far as the line.
 */
export function paintNight(lanes: LaneEls[], track: HTMLElement, night: Night, dark: Dark[], now: number): Omit<Painted, 'holes'> {
  for (const l of lanes) l.tape.querySelectorAll('.work, .work-label, .trail, .trail-tag, .stamp').forEach((e) => e.remove());
  track.querySelectorAll('.roll-dark').forEach((e) => e.remove());
  const grows: Timed[] = [];
  const waits: Wait[] = [];
  const stamps: Timed[] = [];

  for (const w of night.work) {
    const lane = lanes[w.lane];
    const bar = make('i', 'work');
    at(bar, w.from, w.to - w.from);
    if (w.cut) bar.dataset.cut = '';
    if (w.from === 0 && lane.doing) {
      const label = make('em', 'work-label', lane.doing);
      at(label, w.from);
      lane.tape.append(label);
    }
    lane.tape.append(bar);
    grows.push({ el: bar, from: w.from, to: w.to });
  }
  for (const r of night.runs) {
    const tape = lanes[r.task.lane].tape;
    if (!r.late && r.at > r.due) {
      const trail = make('i', 'trail');
      const tag = make('b', 'trail-tag', 'waits');
      at(trail, r.due, r.at - r.due);
      at(tag, r.due);
      tape.append(trail, tag);
      waits.push({ el: trail, tag, from: r.due, to: r.at });
    }
    const stamp = make('b', 'stamp', STAMP[r.outcome]);
    stamp.dataset.outcome = r.outcome;
    if (r.late) stamp.append(make('small', '', 'late'));
    if (r.at <= now) quiet(stamp);
    at(stamp, r.at);
    tape.append(stamp);
    stamps.push({ el: stamp, from: r.at, to: NIGHT });
  }
  let open: Timed | undefined;
  for (const d of dark) {
    const band = make('i', 'roll-dark');
    band.setAttribute('aria-hidden', 'true');
    at(band, d.from, d.to - d.from);
    band.append(make('b', '', 'phone off'));
    track.append(band);
    if (d.to > NIGHT) open = { el: band, from: d.from, to: NIGHT };
  }
  return { grows, waits, stamps, open };
}

/** Shown already: on, with no entrance. */
const quiet = (el: HTMLElement) => {
  el.dataset.on = '';
  el.dataset.quiet = '';
};

/** On or off; once off, it makes its entrance again next time. */
const show = (el: HTMLElement, on: boolean) => {
  el.toggleAttribute('data-on', on);
  if (!on) el.removeAttribute('data-quiet');
};

/** Draws a bar as far as minute `t` by clipping off the rest; untouched when that hasn't moved. */
const grow = (t: number, x: Timed) => {
  const g = Math.round(Math.max(0, Math.min(1, (t - x.from) / Math.max(1, x.to - x.from))) * 1000) / 1000;
  if (g === x.g) return;
  x.g = g;
  x.el.style.clipPath = g >= 1 ? 'none' : `inset(0 ${((1 - g) * 100).toFixed(1)}% 0 0)`;
};

/** Everything the line has reached by minute `t`. */
export function paintFrame(t: number, lanes: LaneEls[], night: Night, painted: Painted) {
  for (const h of painted.holes) if (h.el.dataset.set != null) show(h.el, t >= h.from);
  for (const s of painted.stamps) show(s.el, t >= s.from);
  for (const g of painted.grows) grow(t, g);
  for (const w of painted.waits) {
    grow(t, w);
    w.tag.toggleAttribute('data-on', t >= w.from && t < w.to);
  }
  if (painted.open) at(painted.open.el, painted.open.from, t - painted.open.from);
  lanes.forEach((l, i) => {
    const state = stateAt(night, i, t);
    if (l.el.dataset.state !== state) l.el.dataset.state = state;
  });
}
