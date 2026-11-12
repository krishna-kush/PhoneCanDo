// The screen's line (components/sections/crew/Queue.astro): a phone has one
// screen, so one agent drives it at a time. Take a number and the next agent
// on the bench asks for it: it gets the screen if it is free, else a place in
// line, and the agent on the screen hears who waits. Hand it back and the
// first in line hears it is theirs. An agent whose turn another agent's note
// started is refused: phone control stays with work you started. What each
// is told is the runner's own wording (bridge/Reply.kt,
// messages/ScreenMessages.kt).

import { cueMascot } from '../mascotCue';
import { toyLines } from '../../data/mascot';

const restart = (el: HTMLElement, attr: string) => {
  el.removeAttribute(attr);
  void el.offsetWidth;
  el.setAttribute(attr, '');
};

export function mountQueue(root: HTMLElement) {
  const q = <T extends Element>(sel: string) => root.querySelector<T>(sel);
  const screen = q<HTMLElement>('[data-q-screen]');
  const line = q<HTMLElement>('[data-q-line]');
  const bench = q<HTMLElement>('[data-q-bench]');
  const now = q<HTMLElement>('[data-now]');
  const log = q<HTMLElement>('[data-q-log]');
  const take = q<HTMLButtonElement>('[data-take]');
  const done = q<HTMLButtonElement>('[data-done]');
  if (!screen || !line || !bench || !now || !log || !take || !done) return;
  const bots = [...root.querySelectorAll<HTMLElement>('[data-qbot]')];
  const still = matchMedia('(prefers-reduced-motion: reduce)');
  let next = Number(root.dataset.next ?? 1);

  const name = (bot: HTMLElement) => bot.dataset.name ?? '';
  const holder = () => screen.querySelector<HTMLElement>('[data-qbot]');
  const waiting = () => [...line.querySelectorAll<HTMLElement>('[data-qbot]')];
  const ticket = (bot: HTMLElement, n: string) => {
    bot.dataset.ticket = n;
    const tab = bot.querySelector('[data-tab]');
    if (tab) tab.textContent = n ? `No. ${n}` : '';
  };

  // Every bot hops from where it stood to where it stands now.
  function shuffle(move: () => void) {
    const before = new Map(bots.map((b) => [b, b.getBoundingClientRect()]));
    move();
    if (still.matches) return;
    for (const b of bots) {
      const was = before.get(b);
      const is = b.getBoundingClientRect();
      if (!was) continue;
      const dx = was.left - is.left;
      const dy = was.top - is.top;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue;
      b.animate(
        [
          { transform: `translate(${dx}px, ${dy}px)` },
          { transform: `translate(${dx * 0.45}px, ${dy * 0.45 - 30}px) rotate(-8deg)`, offset: 0.5 },
          { transform: 'none' },
        ],
        { duration: 620, easing: 'cubic-bezier(0.3, 0.9, 0.4, 1)' },
      );
    }
  }

  /** A notice to [to], at the top of the log, as the agent gets it. */
  const tell = (to: string, text: string) => {
    const li = document.createElement('li');
    li.append(Object.assign(document.createElement('b'), { textContent: `To ${to}` }), ` ${text}`);
    log.prepend(li);
    while (log.children.length > 4) log.lastElementChild?.remove();
  };

  const show = (n: string) => {
    now.textContent = n;
    restart(now, 'data-flip');
  };

  const sync = () => {
    take.disabled = !bench.querySelector('[data-qbot]');
    done.disabled = !holder();
    root.toggleAttribute('data-free', !holder());
  };

  take.addEventListener('click', () => {
    const bot = bench.querySelector<HTMLElement>('[data-qbot]');
    if (!bot) return;
    if (bot.hasAttribute('data-woken')) {
      // Its turn is over once refused; it can ask on its next own turn.
      restart(bot, 'data-refused');
      tell(name(bot), "a turn another agent's message started can't take the screen.");
      cueMascot({ say: toyLines.crew.cutIn, move: 'shake' });
      window.setTimeout(() => {
        bot.removeAttribute('data-woken');
        shuffle(() => bench.append(bot));
      }, 900);
      return;
    }
    const n = String(next++).padStart(2, '0');
    ticket(bot, n);
    const h = holder();
    if (!h) {
      shuffle(() => screen.append(bot));
      show(n);
      tell(name(bot), 'The screen is yours now.');
      cueMascot({ say: toyLines.crew.yours, move: 'hop' });
    } else {
      shuffle(() => line.append(bot));
      const place = waiting().length;
      tell(name(bot), `${name(h)} holds the screen; you are #${place} in line; we'll message you when it is yours.`);
      tell(name(h), `${name(bot)} is waiting for the screen.`);
      cueMascot({ say: toyLines.crew.queued(place), move: 'hop' });
    }
    sync();
  });

  const handBack = () => {
    const h = holder();
    if (!h) return;
    const [first] = waiting();
    ticket(h, '');
    shuffle(() => {
      bench.append(h);
      if (first) screen.append(first);
    });
    if (first) {
      show(first.dataset.ticket ?? '');
      tell(name(first), 'The screen is yours now.');
      cueMascot({ say: toyLines.crew.yours, move: 'hop' });
    } else {
      show('––');
    }
    sync();
  };
  done.addEventListener('click', handBack);
  screen.addEventListener('click', handBack);

  sync();
}
