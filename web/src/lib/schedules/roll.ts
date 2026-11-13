// The night roll's wiring (components/sections/schedules/NightRoll.astro).
// "Go to sleep" runs the night from 21:00 to 09:00; as the line passes a run
// its agent's alarm rings and A-01 says what happened. You punch and pull
// tasks, hold the power button to switch the phone off while the night runs,
// scrub on the sky or the clock and change which night it is; at 09:00 the
// receipt feeds out, and tearing it off sweeps the line back for a new
// night. The line, the moon and the sun move by transform only, measured
// once per resize, so they glide. night.ts decides what happens, sky.ts
// where the moon and sun are, paint.ts draws it, input.ts takes your hands.
// The first time the roll is on screen it plays the night once by itself.

import { cueMascot, type MascotCue } from '../mascotCue';
import { toyLines } from '../../data/mascot';
import { clock } from './clock';
import { holdOn, punchOn, scrubOn } from './input';
import { NIGHT, playNight, type Dark, type Lane, type Night, type Outcome, type Rules, type Task } from './night';
import { paintFrame, paintNight, paintTasks, type LaneEls, type Painted } from './paint';
import { fillReceipt } from './printer';
import { moonAt, sunAt } from './sky';

type Data = {
  lanes: (Lane & { doing?: string })[];
  names: string[];
  tasks: Task[];
  rules: Rules;
  perAgent: number;
  picks: string[];
  eve: number;
};

/** The whole night takes this long to play. */
const PLAY_MS = 18000;
/** The sweep back to 21:00 for a new night. */
const REWIND_MS = 700;
/** The receipt's tear, then the slot closing (NightRoll.astro's CSS). */
const TEAR_MS = 550;
const CLOSE_MS = 500;
/** A new task's run, in minutes. */
const RUN = 30;
/** A's lines need this long apart to be read; the big moments jump the queue. */
const CUE_GAP_MS = 1300;

const easeInOut = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2);

export function mountRoll(root: HTMLElement) {
  const q = <T extends Element>(sel: string) => root.querySelector<T>(sel);
  const track = q<HTMLElement>('[data-track]');
  const sky = q<HTMLElement>('[data-sky]');
  const hours = q<HTMLElement>('[data-hours]');
  const head = q<HTMLElement>('[data-head]');
  const nowTag = q<HTMLElement>('[data-now]');
  const moon = q<HTMLElement>('[data-moon]');
  const sun = q<HTMLElement>('[data-sun]');
  const go = q<HTMLButtonElement>('[data-go]');
  const goLabel = q<HTMLElement>('[data-go-label]');
  const power = q<HTMLButtonElement>('[data-power]');
  const day = q<HTMLButtonElement>('[data-day]');
  const dayName = q<HTMLElement>('[data-day-name]');
  const receipt = q<HTMLElement>('[data-receipt]');
  const tear = q<HTMLButtonElement>('[data-tear]');
  const live = q<HTMLElement>('[data-live]');
  if (!track || !sky || !hours || !head || !nowTag || !moon || !sun || !go || !goLabel || !power || !day || !dayName || !receipt || !tear || !live) return;
  const data = JSON.parse(q('[data-night]')?.textContent ?? '{}') as Data;
  const days = (day.dataset.days ?? '').split(' ');
  const lanes: LaneEls[] = [...root.querySelectorAll<HTMLElement>('[data-lane]')].map((el, i) => ({
    el,
    tape: el.querySelector<HTMLElement>('[data-tape]') ?? el,
    doing: data.lanes[i]?.doing,
  }));
  const still = matchMedia('(prefers-reduced-motion: reduce)');
  const later = (ms: number, fn: () => void) => window.setTimeout(fn, still.matches ? 0 : ms);

  let tasks = [...data.tasks];
  let dark: Dark[] = [];
  const pulled = new Set<string>();
  let eve = data.eve;
  let every = 0;
  let punched = 0;
  let t = 0;
  let playing = false;
  let holding = false;
  let tearing = false;
  let started = false;
  let frame = 0;
  let rewinding = 0;
  let last = 0;
  let night: Night;
  let painted: Painted;

  // ---- A-01 and the screen reader
  let cuedAt = 0;
  const cue = (c: MascotCue, big = false) => {
    const now = performance.now();
    if (!big && now - cuedAt < CUE_GAP_MS) return;
    cuedAt = now;
    cueMascot(c);
  };
  const say = (line: string) => (live.textContent = line);

  // ---- the night, played and drawn
  const printed = () => root.hasAttribute('data-printed');
  const fill = () => fillReceipt(receipt, night.runs, data.names, `${days[eve]} 21:00 to ${days[(eve + 1) % 7]} 09:00`);
  const redraw = (fresh?: string) => {
    night = playNight(data.lanes, tasks, dark, eve, data.rules, pulled);
    const holes = paintTasks(lanes, [...tasks, ...night.notes], eve, t, fresh);
    painted = { holes, ...paintNight(lanes, track, night, dark, t) };
    if (printed()) fill();
    paint();
  };

  // The sky's size, read once and again on a resize, never per frame.
  let width = sky.clientWidth;
  let height = sky.clientHeight;
  let shown = -1;
  /** A body `up` high (0 under the horizon, 1 at the top) at x, leaning. */
  const place = (el: HTMLElement, x: number, up: number, lean: number) => {
    const y = height + 11 - up * (height - 2);
    el.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0) rotate(${lean.toFixed(1)}deg)`;
  };
  const paint = () => {
    paintFrame(t, lanes, night, painted);
    const p = t / NIGHT;
    const x = p * width;
    head.style.transform = `translate3d(${x.toFixed(1)}px,0,0)`;
    // The clock leans into the night at either end, so it never hangs off.
    nowTag.style.transform = `translate3d(${(-p * 100).toFixed(1)}%,0,0)`;
    // The moon and sun ride the line, kept a body's width inside either end.
    const bx = 12 + p * Math.max(0, width - 24);
    const m = moonAt(t);
    const s = sunAt(t);
    place(moon, bx, m.up, m.lean);
    place(sun, bx, s.up, s.lean);
    const minute = Math.floor(t);
    if (minute !== shown) {
      shown = minute;
      const text = clock(minute);
      nowTag.textContent = text;
      nowTag.setAttribute('aria-valuenow', String(minute));
      nowTag.setAttribute('aria-valuetext', text);
    }
    root.toggleAttribute('data-asleep', t > 0 && t < NIGHT);
  };

  // ---- what happens as the line passes
  const RUN_LINE: Record<Outcome, string> = {
    started: toyLines.night.started,
    woke: toyLines.night.woke,
    restarted: toyLines.night.restarted,
    skipped: toyLines.night.skipped,
  };
  const ring = (lane: LaneEls) => {
    lane.el.removeAttribute('data-ring');
    void lane.el.offsetWidth;
    lane.el.setAttribute('data-ring', '');
    window.setTimeout(() => lane.el.removeAttribute('data-ring'), 900);
  };
  const passed = (from: number, to: number) => {
    for (const r of night.runs) {
      if (r.at <= from || r.at > to) continue;
      if (r.outcome !== 'skipped') ring(lanes[r.task.lane]);
      const line = r.late ? toyLines.night.late : r.task.by === 'agent' ? toyLines.night.own : RUN_LINE[r.outcome];
      cue({ say: line, move: r.outcome === 'skipped' ? 'shake' : 'hop' });
    }
    for (const n of night.notes) if (n.setAt != null && n.setAt > from && n.setAt <= to) cue({ say: toyLines.night.ownSet, move: 'hop' }, true);
    // A task that finds its agent busy starts to wait.
    for (const r of night.runs) if (r.due > from && r.due <= to && r.at > r.due && !r.late) cue({ say: toyLines.night.waits });
  };

  // ---- playing
  const setGo = () => {
    const label = playing ? go.dataset.pause : t >= NIGHT ? go.dataset.again : go.dataset.play;
    goLabel.textContent = label ?? '';
    go.setAttribute('aria-pressed', String(playing));
    root.toggleAttribute('data-playing', playing);
  };
  const tick = (now: number) => {
    const from = t;
    t = Math.min(NIGHT, t + (Math.min(64, now - last) * NIGHT) / PLAY_MS);
    last = now;
    paint();
    passed(from, t);
    if (t >= NIGHT) {
      if (holding) lightsOn();
      pause();
      morning();
      return;
    }
    frame = requestAnimationFrame(tick);
  };
  const play = () => {
    started = true;
    if (rewinding || tearing) return;
    // At 09:00 the receipt goes back in and the line sweeps back first.
    if (t >= NIGHT) {
      root.removeAttribute('data-printed');
      return rewind(play);
    }
    if (playing) return;
    playing = true;
    last = performance.now();
    frame = requestAnimationFrame(tick);
    setGo();
    if (t === 0) cue({ say: toyLines.night.asleep, move: 'hop' }, true);
  };
  const pause = () => {
    playing = false;
    cancelAnimationFrame(frame);
    setGo();
  };
  go.addEventListener('click', () => (playing ? pause() : play()));

  // ---- morning: the receipt feeds out; torn off, the line sweeps back
  const morning = () => {
    if (printed()) return;
    fill();
    root.setAttribute('data-printed', '');
    setGo();
    cue({ say: toyLines.night.morning, move: 'hop' }, true);
    say(`Morning. ${receipt.querySelector('[data-total]')?.textContent ?? ''}`);
  };
  /** Sweeps the line back to 21:00, easing in and out, then clears the dark for a new night. */
  const rewind = (then?: () => void) => {
    pause();
    const from = t;
    const begin = performance.now();
    const ms = still.matches || from === 0 ? 0 : REWIND_MS;
    const step = (now: number) => {
      const k = ms ? Math.min(1, (now - begin) / ms) : 1;
      t = from * (1 - easeInOut(k));
      paint();
      if (k < 1) {
        rewinding = requestAnimationFrame(step);
        return;
      }
      rewinding = 0;
      t = 0;
      dark = [];
      redraw();
      setGo();
      then?.();
    };
    rewinding = requestAnimationFrame(step);
  };
  tear.addEventListener('click', () => {
    if (tearing) return;
    tearing = true;
    pause();
    cue({ say: toyLines.night.torn, move: 'hop' }, true);
    receipt.setAttribute('data-torn', '');
    later(TEAR_MS, () => {
      root.removeAttribute('data-printed');
      rewind();
      later(CLOSE_MS, () => {
        receipt.removeAttribute('data-torn');
        tearing = false;
      });
    });
  });

  // ---- scrub on the sky, the hours or the clock
  const scrubTo = (m: number) => {
    if (holding || rewinding || tearing) return;
    pause();
    t = Math.max(0, Math.min(NIGHT, m));
    if (t < NIGHT) root.removeAttribute('data-printed');
    paint();
    setGo();
    if (t >= NIGHT) morning();
  };
  scrubOn([sky, hours, nowTag], sky, nowTag, scrubTo, () => t);

  // ---- the power button: the phone is off while you hold it
  const lightsOut = () => {
    if (t >= NIGHT || rewinding || tearing) return cue({ say: toyLines.night.morning, move: 'shake' });
    holding = true;
    power.setAttribute('aria-pressed', 'true');
    // Off until you let go: played as off for the rest of the night, drawn
    // as far as the line.
    dark = [...dark, { from: Math.floor(t), to: NIGHT + 1 }];
    redraw();
    cue({ say: toyLines.night.off, move: 'shake' }, true);
    say('Phone off. Every agent stops; nothing runs until it is back on.');
    if (!playing) play();
  };
  const lightsOn = () => {
    if (!holding) return;
    holding = false;
    power.setAttribute('aria-pressed', 'false');
    const back = dark[dark.length - 1];
    back.to = Math.max(back.from + 1, Math.ceil(t));
    redraw();
    const late = night.runs.filter((r) => r.late && r.at === back.to).length;
    cue({ say: late ? toyLines.night.catchUp(late) : toyLines.night.on, move: 'hop' }, true);
    say(late ? `Back on. ${late} missed ${late === 1 ? 'task runs' : 'tasks run'} once now, late.` : 'Back on. Nothing came due while it was off.');
  };
  holdOn(power, lightsOut, lightsOn);

  // ---- punch a task, pull one
  const nope = (lane: LaneEls, line: string) => {
    lane.el.removeAttribute('data-nope');
    void lane.el.offsetWidth;
    lane.el.setAttribute('data-nope', '');
    cue({ say: line, move: 'shake' }, true);
  };
  const punch = (i: number, minute: number) => {
    const lane = lanes[i];
    const name = data.names[i];
    if (data.lanes[i].level === 'none') {
      say(`${name} can't run schedules: it takes no task at start and can't be woken.`);
      return nope(lane, toyLines.night.cant);
    }
    const mine = tasks.filter((x) => x.lane === i).length + night.notes.filter((x) => x.lane === i).length;
    if (mine >= data.perAgent) {
      say(`${name} has ${data.perAgent} schedules, the most one agent can have.`);
      return nope(lane, toyLines.night.full(data.perAgent));
    }
    const at = Math.min(NIGHT - 15, Math.round(minute / 15) * 15);
    const text = data.picks[punched++ % data.picks.length];
    const id = `p${punched}`;
    tasks = [...tasks, { id, lane: i, text, at, every: every || undefined, by: 'you', run: RUN }];
    redraw(id);
    cue({ say: toyLines.night.punched, move: 'hop' }, true);
    say(`Set for ${name} at ${clock(at)}${every ? `, every ${every / 60} h` : ''}: ${text}.`);
  };
  const pull = (i: number, id: string) => {
    const note = night.notes.find((x) => x.id === id);
    if (note) pulled.add(id);
    else tasks = tasks.filter((x) => x.id !== id);
    redraw();
    cue({ say: toyLines.night.pulled, move: 'shake' }, true);
    say(`Taken out: ${note?.text ?? 'the task'} for ${data.names[i]}.`);
  };
  punchOn(
    lanes.map((l) => l.tape),
    punch,
    pull,
    () => t,
  );

  // ---- once, hourly or every 2 h
  const chips = [...root.querySelectorAll<HTMLButtonElement>('[data-every]')];
  for (const chip of chips) {
    chip.addEventListener('click', () => {
      every = Number(chip.dataset.every) || 0;
      for (const c of chips) c.setAttribute('aria-pressed', String(c === chip));
    });
  }

  // ---- which night: a weekday task skips the weekend
  day.addEventListener('click', () => {
    eve = (eve + 1) % 7;
    dayName.textContent = days[eve];
    redraw();
    cue({ say: toyLines.night.day(days[eve]), move: 'hop' }, true);
  });

  redraw();
  if ('ResizeObserver' in window) {
    new ResizeObserver(() => {
      width = sky.clientWidth;
      height = sky.clientHeight;
      paint();
    }).observe(sky);
  }

  // The first time it's on screen, the night plays once by itself.
  if (still.matches || !('IntersectionObserver' in window)) return;
  const seen = new IntersectionObserver(
    (entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      seen.disconnect();
      if (!started) play();
    },
    { threshold: 0.6 },
  );
  seen.observe(track);
}
