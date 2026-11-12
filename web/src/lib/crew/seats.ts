// One agent on the floor plan (components/sections/crew/Seat.astro): its
// parts on the page and the state the rules read. The seat's data-state
// drives the CSS: working (it bobs, dots over its head), idle (sleepy, z's),
// stopped (a dashed ghost).

import type { Level, SeatState } from './rules';

export type Seat = {
  id: string;
  name: string;
  level: Level;
  room: number;
  el: HTMLElement;
  bot: HTMLButtonElement;
  pile: HTMLElement;
  pileCount: HTMLElement;
  stamp: HTMLElement;
  sign: HTMLButtonElement | null;
  tally: HTMLElement[];
  jobChip: HTMLElement | null;
  state: SeatState;
  /** "Other agents can wake it". */
  wakeable: boolean;
  /** Times woken this hour. */
  wakes: number;
  /** Notes waiting for its next turn (or, inbox only, for it to check). */
  waiting: number;
  job: string | null;
  kept: boolean;
  /** Its next change of its own: a turn starting or ending, the idle stop. */
  timer: number;
};

const need = <T extends Element>(el: T | null, what: string): T => {
  if (!el) throw new Error(`floor plan seat: no ${what}`);
  return el;
};

export function readSeats(root: HTMLElement): Seat[] {
  return [...root.querySelectorAll<HTMLElement>('[data-seat]')].map((el) => ({
    id: el.dataset.seat ?? '',
    name: el.dataset.name ?? '',
    level: el.dataset.level as Level,
    room: Number(el.closest<HTMLElement>('[data-room]')?.dataset.room ?? 0),
    el,
    bot: need(el.querySelector<HTMLButtonElement>('[data-bot]'), 'bot'),
    pile: need(el.querySelector<HTMLElement>('[data-pile]'), 'pile'),
    pileCount: need(el.querySelector<HTMLElement>('[data-pile-n]'), 'pile count'),
    stamp: need(el.querySelector<HTMLElement>('[data-stamp]'), 'stamp'),
    sign: el.querySelector<HTMLButtonElement>('[data-sign]'),
    tally: [...el.querySelectorAll<HTMLElement>('[data-tally] i')],
    jobChip: el.querySelector<HTMLElement>('[data-job-chip]'),
    state: el.dataset.state as SeatState,
    wakeable: true,
    wakes: 0,
    waiting: 0,
    job: el.dataset.job ?? null,
    kept: el.hasAttribute('data-kept'),
    timer: 0,
  }));
}

const STATE_WORDS: Record<SeatState, string> = { working: 'working', idle: 'idle', stopped: 'stopped' };

/** The bot's name for assistive tech: who, what it's doing, what a press does. */
function label(seat: Seat, armed: boolean) {
  const waiting = seat.waiting ? `, ${seat.waiting} note${seat.waiting === 1 ? '' : 's'} waiting` : '';
  const act = armed ? 'press again to put the note down' : 'press to write a note from it';
  seat.bot.setAttribute('aria-label', `${seat.name}, ${STATE_WORDS[seat.state]}${waiting}: ${act}`);
}

export function setState(seat: Seat, state: SeatState) {
  seat.state = state;
  seat.el.dataset.state = state;
  label(seat, seat.el.hasAttribute('data-armed'));
}

export function setArmed(seat: Seat, armed: boolean) {
  seat.el.toggleAttribute('data-armed', armed);
  label(seat, armed);
}

export function setWaiting(seat: Seat, n: number) {
  seat.waiting = n;
  seat.pile.dataset.n = String(Math.min(n, 3));
  seat.pileCount.textContent = String(n);
  label(seat, seat.el.hasAttribute('data-armed'));
}

const restart = (el: HTMLElement, attr: string, value = '') => {
  el.removeAttribute(attr);
  void el.offsetWidth;
  el.setAttribute(attr, value);
};

/** Slams the seat's rubber stamp down with [head] over [sub]; red ink, or amber for the quiet ones. */
export function slam(seat: Seat, [head, sub]: [string, string], ink: 'red' | 'amber') {
  const [b, small] = seat.stamp.children as HTMLCollectionOf<HTMLElement>;
  b.textContent = head;
  small.textContent = sub;
  seat.stamp.dataset.ink = ink;
  restart(seat.stamp, 'data-on');
}

/** A one-shot move on the seat: jolt (woken), shake (refused), gulp (reads its pile). */
export function nudge(seat: Seat, move: 'jolt' | 'shake' | 'gulp') {
  restart(seat.el, 'data-move', move);
}

export function tallyUp(seat: Seat) {
  seat.tally[seat.wakes - 1]?.setAttribute('data-used', '');
  seat.el.toggleAttribute('data-spent', seat.wakes >= seat.tally.length);
}
