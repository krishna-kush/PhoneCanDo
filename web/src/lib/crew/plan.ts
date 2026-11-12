// The floor plan's wiring (components/sections/crew/FloorPlan.astro): the
// agents on the phone, in their machines, passing notes. Drag a note from
// one agent to another, or tap one and then another (keys work the same);
// drop it on @machine or @phone for everyone. post.ts carries it, turns.ts
// keeps time, and the shift switch sends you away for the night. The first
// time the plan is on screen two agents that wake show how far a chain of
// answers goes.

import { cueMascot } from '../mascotCue';
import { toyLines } from '../../data/mascot';
import { dragFrom } from './drag';
import { centerOf, makeNote, place, pointIn, type Point } from './flight';
import { later, type Floor } from './floor';
import { makePost } from './post';
import { readSeats, setArmed, setState, slam, nudge, type Seat } from './seats';
import { makeTurns } from './turns';

export function mountFloorPlan(root: HTMLElement) {
  const q = <T extends Element>(sel: string) => root.querySelector<T>(sel);
  const stage = q<HTMLElement>('[data-stage]');
  const chute = q<HTMLElement>('[data-chute]');
  const glass = q<HTMLElement>('[data-glass]');
  const leader = q<SVGLineElement>('[data-leader] line');
  const live = q<HTMLElement>('[data-live]');
  const hint = q<HTMLElement>('[data-hint]');
  const shift = q<HTMLButtonElement>('[data-shift]');
  const shiftLabel = q<HTMLElement>('[data-shift-label]');
  const notice = q<HTMLElement>('[data-notice]');
  if (!stage || !chute || !glass || !leader || !live || !hint || !shift || !shiftLabel || !notice) return;
  const pads = [...root.querySelectorAll<HTMLButtonElement>('[data-pad]')];

  const floor: Floor = {
    root,
    stage,
    chute,
    glass,
    seats: readSeats(root),
    limits: { wakesPerHour: Number(root.dataset.wakes), noWakeHop: Number(root.dataset.hop) },
    still: matchMedia('(prefers-reduced-motion: reduce)'),
    away: false,
    onScreen: false,
    say: (line) => (live.textContent = line),
  };
  const turns = makeTurns(floor, notice);
  const post = makePost(floor, turns);
  const hints = { idle: hint.textContent ?? '', armed: hint.dataset.armed ?? '' };

  // ---- tap one agent, then who gets it
  let armed: Seat | null = null;
  let held: HTMLElement | null = null;

  const disarm = () => {
    if (armed) setArmed(armed, false);
    armed = null;
    held?.remove();
    held = null;
    root.removeAttribute('data-armed');
    hint.textContent = hints.idle;
  };
  const arm = (seat: Seat) => {
    disarm();
    armed = seat;
    setArmed(seat, true);
    root.setAttribute('data-armed', '');
    hint.textContent = hints.armed;
    const top = centerOf(seat.bot, stage);
    held = makeNote(stage, { x: top.x, y: top.y - 34 });
    held.setAttribute('data-held', '');
  };
  // A stopped agent writes nothing; it starts again when you open it.
  const refuseStopped = (seat: Seat) => {
    slam(seat, ['Stopped', 'starts when you open it'], 'red');
    nudge(seat, 'shake');
    floor.say(`${seat.name} is stopped, so it can't write a note. It starts again when you open it.`);
  };

  const tap = (seat: Seat) => {
    if (armed === seat) return disarm();
    if (armed) {
      const from = armed;
      disarm();
      return void post.send(from, { seat }, 0);
    }
    if (seat.state === 'stopped') return refuseStopped(seat);
    arm(seat);
  };

  const nudgeHint = () => {
    hint.removeAttribute('data-nudge');
    void hint.offsetWidth;
    hint.setAttribute('data-nudge', '');
  };
  for (const pad of pads) {
    pad.addEventListener('click', () => {
      if (!armed) {
        nudgeHint();
        floor.say('Pick who writes it first: press an agent, then this.');
        return;
      }
      const from = armed;
      disarm();
      void post.send(from, { all: pad.dataset.pad === 'machine' ? 'machine' : 'phone' }, 0);
    });
  }
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && armed) disarm();
  });

  // ---- drag a note from an agent
  let dragged: { from: Seat; note: HTMLElement } | null = null;
  let over: Element | null = null;

  const targetAt = (x: number, y: number, from: Seat): Element | null => {
    const hit = document.elementFromPoint(x, y)?.closest('[data-seat], [data-pad]') ?? null;
    return hit && hit !== from.el && root.contains(hit) ? hit : null;
  };
  const hover = (el: Element | null) => {
    if (el === over) return;
    over?.removeAttribute('data-over');
    el?.setAttribute('data-over', '');
    over = el;
  };
  const drawLeader = (a: Point, b: Point) => {
    leader.setAttribute('x1', String(a.x));
    leader.setAttribute('y1', String(a.y));
    leader.setAttribute('x2', String(b.x));
    leader.setAttribute('y2', String(b.y));
  };
  const endDrag = () => {
    hover(null);
    root.removeAttribute('data-dragging');
    dragged?.from.el.removeAttribute('data-sender');
    dragged?.note.remove();
    dragged = null;
  };

  for (const seat of floor.seats) {
    dragFrom(seat.bot, {
      start(e) {
        if (seat.state === 'stopped') {
          refuseStopped(seat);
          return false;
        }
        disarm();
        dragged = { from: seat, note: makeNote(stage, pointIn(e, stage)) };
        seat.el.setAttribute('data-sender', '');
        root.setAttribute('data-dragging', '');
        return true;
      },
      move(e) {
        if (!dragged) return;
        const p = pointIn(e, stage);
        place(dragged.note, p, -8);
        drawLeader(centerOf(seat.bot, stage), p);
        hover(targetAt(e.clientX, e.clientY, seat));
      },
      drop(e) {
        if (!dragged) return;
        const p = pointIn(e, stage);
        const target = targetAt(e.clientX, e.clientY, seat);
        const box = stage.getBoundingClientRect();
        const outside = e.clientX < box.left || e.clientX > box.right || e.clientY < box.top || e.clientY > box.bottom;
        endDrag();
        if (outside) return post.offPhone(seat, p);
        if (!target) return void post.returnTo(seat, p);
        const pad = (target as HTMLElement).dataset.pad;
        if (pad) return void post.send(seat, { all: pad === 'machine' ? 'machine' : 'phone' }, 0, p);
        const to = floor.seats.find((s) => s.el === target);
        if (to) void post.send(seat, { seat: to }, 0, p);
      },
      cancel: endDrag,
    });
    seat.bot.addEventListener('click', () => tap(seat));

    // The door sign: "Other agents can wake it", flipped by hand.
    seat.sign?.addEventListener('click', () => {
      seat.wakeable = !seat.wakeable;
      seat.sign?.setAttribute('aria-pressed', String(seat.wakeable));
      seat.el.toggleAttribute('data-dnd', !seat.wakeable);
      floor.say(seat.wakeable ? `Other agents can wake ${seat.name} again.` : `Other agents can no longer wake ${seat.name}.`);
      cueMascot({ say: seat.wakeable ? toyLines.crew.wakeOn : toyLines.crew.dnd, move: 'hop' });
    });
  }

  // ---- you're here, or away for the night
  shift.addEventListener('click', () => {
    floor.away = !floor.away;
    root.toggleAttribute('data-away', floor.away);
    shift.setAttribute('aria-pressed', String(floor.away));
    shiftLabel.textContent = (floor.away ? shift.dataset.away : shift.dataset.here) ?? '';
    disarm();
    // Back: opening the app starts them again.
    if (!floor.away) for (const s of floor.seats) if (s.state === 'stopped') setState(s, 'idle');
    for (const s of floor.seats) turns.plan(s);
    turns.renderNotice();
    floor.say(
      floor.away
        ? 'You left: the app is in the background and the screen is off. Agents at work go on; idle ones with nothing running stop soon.'
        : 'You are back: every agent is up again.',
    );
    cueMascot({ say: floor.away ? toyLines.crew.away : toyLines.crew.back, move: 'hop' });
  });

  // ---- time moves only while the plan is on screen
  let introDone = false;
  new IntersectionObserver(
    ([entry]) => {
      floor.onScreen = entry.isIntersecting;
      for (const s of floor.seats) floor.onScreen ? turns.plan(s) : window.clearTimeout(s.timer);
      if (floor.onScreen && !introDone) {
        introDone = true;
        later(900, intro);
      }
    },
    { threshold: 0.45 },
  ).observe(stage);

  // Two agents that wake, both idle: one asks the other, the answer wakes
  // the first, and the answer to that wakes no one.
  function intro() {
    const [a, b] = floor.seats.filter((s) => s.level === 'wakes');
    if (!a || !b || armed || dragged) return;
    if (a.state !== 'idle' || b.state !== 'idle' || !a.wakeable || !b.wakeable) return;
    void post.send(b, { seat: a }, 0);
  }
}
