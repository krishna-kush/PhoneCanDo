// The roll's hands-on parts (NightRoll.astro): drag the sky, the hours or
// the line's clock to scrub, hold the power button, punch the tape. Each
// tells roll.ts what you did; none knows the night.

import { clock } from './clock';
import { NIGHT } from './night';

const minuteAt = (el: HTMLElement, clientX: number) => {
  const box = el.getBoundingClientRect();
  return Math.max(0, Math.min(1, (clientX - box.left) / box.width)) * NIGHT;
};

/**
 * Dragging on any of `surfaces` scrubs, measured across `across` (the sky:
 * the night's width); `handle` is the slider, so keys move it too.
 */
export function scrubOn(
  surfaces: HTMLElement[],
  across: HTMLElement,
  handle: HTMLElement,
  to: (m: number) => void,
  now: () => number,
) {
  for (const el of surfaces) {
    let dragging = false;
    el.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      dragging = true;
      el.setPointerCapture(e.pointerId);
      to(minuteAt(across, e.clientX));
    });
    el.addEventListener('pointermove', (e) => dragging && to(minuteAt(across, e.clientX)));
    const end = () => (dragging = false);
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  }
  const STEP: Record<string, number> = { ArrowRight: 15, ArrowUp: 15, ArrowLeft: -15, ArrowDown: -15, PageUp: 60, PageDown: -60 };
  handle.addEventListener('keydown', (e) => {
    const step = STEP[e.key];
    if (step == null && e.key !== 'Home' && e.key !== 'End') return;
    e.preventDefault();
    to(e.key === 'Home' ? 0 : e.key === 'End' ? NIGHT : Math.round(now() / 15) * 15 + step);
  });
}

/** Held by pointer, Space or Enter: `down` once, then `up` once. */
export function holdOn(button: HTMLElement, down: () => void, up: () => void) {
  let held = false;
  const press = () => {
    if (held) return;
    held = true;
    down();
  };
  const release = () => {
    if (!held) return;
    held = false;
    up();
  };
  button.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    button.setPointerCapture(e.pointerId);
    press();
  });
  button.addEventListener('pointerup', release);
  button.addEventListener('pointercancel', release);
  button.addEventListener('lostpointercapture', release);
  button.addEventListener('keydown', (e) => {
    if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
      e.preventDefault();
      press();
    }
  });
  button.addEventListener('keyup', (e) => (e.key === ' ' || e.key === 'Enter') && release());
  button.addEventListener('blur', release);
  button.addEventListener('contextmenu', (e) => e.preventDefault());
}

/**
 * A click on a lane's tape (a button) punches a task where you clicked, a
 * click on a hole pulls it; Enter or Space punches at the line. A mouse shows
 * where a click would punch.
 */
export function punchOn(
  tapes: HTMLElement[],
  punch: (lane: number, m: number) => void,
  pull: (lane: number, task: string) => void,
  now: () => number,
) {
  tapes.forEach((tape, lane) => {
    const ghost = tape.querySelector<HTMLElement>('[data-ghost]');
    const ghostTime = ghost?.querySelector('b');
    tape.addEventListener('click', (e) => {
      // A click from the keyboard (no pointer, detail 0) punches at the line.
      if (e.detail === 0) return punch(lane, now());
      const hole = (e.target as Element).closest<HTMLElement>('.hole');
      if (hole?.dataset.task) pull(lane, hole.dataset.task);
      else punch(lane, minuteAt(tape, e.clientX));
    });
    if (!ghost || !ghostTime) return;
    tape.addEventListener('pointermove', (e) => {
      const over = e.pointerType === 'mouse' && !(e.target as Element).closest('.hole');
      tape.toggleAttribute('data-hover', over);
      if (!over) return;
      const m = Math.min(NIGHT - 15, Math.round(minuteAt(tape, e.clientX) / 15) * 15);
      ghost.style.setProperty('--x', (m / NIGHT).toFixed(4));
      ghostTime.textContent = clock(m);
    });
    tape.addEventListener('pointerleave', () => tape.removeAttribute('data-hover'));
  });
}
