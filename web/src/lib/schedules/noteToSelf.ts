// FIG. 06B's wiring (components/sections/schedules/NoteToSelf.astro): the
// chat comes in a line at a time and loops while it's on screen; the board's
// note follows the step (CSS reads data-step). The switch turns the agent's
// own reminders off and plays the chat again the other way. With reduced
// motion the whole chat shows at once.

import { cueMascot } from '../mascotCue';
import { toyLines } from '../../data/mascot';

/** How long each step stays before the next; the last holds before the chat starts over. */
const STEP_MS = [700, 1300, 1500, 1800, 1600, 1500, 4200];
const LAST = STEP_MS.length - 1;

export function mountNoteToSelf(root: HTMLElement) {
  const lines = [...root.querySelectorAll<HTMLElement>('li[data-step]')];
  const toggle = root.querySelector<HTMLButtonElement>('[data-switch]');
  if (!toggle) return;
  const still = matchMedia('(prefers-reduced-motion: reduce)');
  let step = 0;
  let timer = 0;
  let onScreen = false;
  root.setAttribute('data-live', '');

  const show = (n: number) => {
    step = n;
    root.dataset.step = String(n);
    for (const l of lines) l.toggleAttribute('data-on', Number(l.dataset.step) <= n);
  };
  const next = () => {
    show(step >= LAST ? 0 : step + 1);
    window.clearTimeout(timer);
    if (onScreen) timer = window.setTimeout(next, STEP_MS[step]);
  };
  const run = () => {
    window.clearTimeout(timer);
    if (still.matches) return show(LAST);
    show(0);
    if (onScreen) timer = window.setTimeout(next, STEP_MS[0]);
  };

  toggle.addEventListener('click', () => {
    const on = root.dataset.self !== 'on';
    root.dataset.self = on ? 'on' : 'off';
    toggle.setAttribute('aria-checked', String(on));
    cueMascot({ say: on ? toyLines.night.own : toyLines.night.selfOff, move: on ? 'hop' : 'shake' });
    run();
  });

  if (still.matches || !('IntersectionObserver' in window)) return show(LAST);
  new IntersectionObserver(
    (entries) => {
      const seen = entries.some((e) => e.isIntersecting);
      if (seen === onScreen) return;
      onScreen = seen;
      if (seen) run();
      else window.clearTimeout(timer);
    },
    { threshold: 0.4 },
  ).observe(root);
}
