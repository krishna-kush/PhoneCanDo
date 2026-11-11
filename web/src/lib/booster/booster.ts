// The booster pack's wiring (components/sections/models/Booster.astro).
// Tear a pack: its strip flies off, three agent cards fly out face down and
// turn over one by one, and the binder files every new one. The cartridge
// pushed into the phone becomes the brain of every card that takes a local
// model, all at once. Which cards come is draw.ts; the lean under the
// pointer, tilt.ts. The root's data-state drives the CSS: sealed, tearing,
// open, clearing.

import { drawPack } from './draw';
import { tiltCards } from './tilt';
import { cueMascot } from '../mascotCue';
import { toyLines } from '../../data/mascot';

type State = 'sealed' | 'tearing' | 'open' | 'clearing';

/** When the cards fly out after the tear, how far apart, and how long they fly (ms). */
const DEAL_AT = 260;
const DEAL_GAP = 110;
const FLIGHT = 650;
/** Each card turns over this long after the one before it lands. */
const TURN_GAP = 140;

const restart = (el: Element, attr: string) => {
  el.removeAttribute(attr);
  void (el as HTMLElement).offsetWidth;
  el.setAttribute(attr, '');
};

export function mountBooster(root: HTMLElement) {
  const pack = root.querySelector<HTMLButtonElement>('[data-pack]');
  const open = root.querySelector<HTMLButtonElement>('[data-open]');
  const openLabel = root.querySelector<HTMLElement>('[data-open-label]');
  const gotCount = root.querySelector<HTMLElement>('[data-got]');
  const live = root.querySelector<HTMLElement>('[data-live]');
  if (!pack || !open || !openLabel || !gotCount || !live) return;
  const cards = new Map([...root.querySelectorAll<HTMLElement>('[data-card]')].map((el) => [el.dataset.card ?? '', el]));
  const slots = new Map([...root.querySelectorAll<HTMLElement>('[data-binder-card]')].map((el) => [el.dataset.binderCard ?? '', el]));
  const carts = [...root.querySelectorAll<HTMLButtonElement>('[data-cart]')];
  const chips = [...root.querySelectorAll<HTMLElement>('[data-brain-name]')];
  const still = matchMedia('(prefers-reduced-motion: reduce)');
  const deck = [...cards.keys()];
  const got = new Set<string>();
  let must = root.dataset.first ? [root.dataset.first] : [];
  let hand: HTMLElement[] = [];

  const state = () => root.dataset.state as State;
  const setState = (s: State) => {
    root.dataset.state = s;
    openLabel.textContent = s === 'sealed' || s === 'tearing' ? 'Tear it open' : 'Another pack';
  };
  const later = (ms: number, then: () => void) => window.setTimeout(then, still.matches ? 0 : ms);

  const tear = () => {
    if (state() !== 'sealed') return;
    setState('tearing');
    const ids = drawPack(deck, got, must);
    must = [];
    hand = deck.filter((id) => ids.includes(id)).map((id) => cards.get(id) as HTMLElement);
    const from = pack.getBoundingClientRect();
    hand.forEach((card, i) => {
      card.hidden = false;
      card.dataset.slot = String(i);
    });
    // Each card flies from the pack's mouth, up and over, into its place.
    hand.forEach((card, i) => {
      if (still.matches) return;
      const to = card.getBoundingClientRect();
      const dx = from.left + from.width / 2 - (to.left + to.width / 2);
      const dy = from.top + from.height / 3 - (to.top + to.height / 2);
      card.animate(
        [
          { transform: `translate(${dx}px, ${dy}px) scale(0.5)`, opacity: 0 },
          { transform: `translate(${dx * 0.45}px, ${dy - 70}px) scale(0.85) rotate(${(i - 1) * 10}deg)`, opacity: 1, offset: 0.4 },
          { transform: 'none', opacity: 1 },
        ],
        { duration: FLIGHT, delay: DEAL_AT + i * DEAL_GAP, easing: 'cubic-bezier(0.2, 0.8, 0.3, 1)', fill: 'backwards' },
      );
    });
    const landed = DEAL_AT + (hand.length - 1) * DEAL_GAP + FLIGHT;
    const fresh = ids.filter((id) => !got.has(id));
    hand.forEach((card, i) =>
      later(landed + i * TURN_GAP, () => {
        delete card.dataset.face;
        card.toggleAttribute('data-new', fresh.includes(card.dataset.card ?? ''));
      }),
    );
    later(landed + hand.length * TURN_GAP + 200, () => {
      for (const id of ids) got.add(id);
      for (const id of fresh) {
        const slot = slots.get(id);
        if (!slot) continue;
        slot.setAttribute('data-got', '');
        restart(slot, 'data-new');
      }
      gotCount.textContent = String(got.size);
      const full = got.size === deck.length;
      root.toggleAttribute('data-full', full);
      setState('open');
      const names = hand.map((card) => card.dataset.label).join(', ');
      live.textContent = `Pack opened: ${names}. ${fresh.length} new, ${got.size} collected${full ? ': the full set' : ''}.`;
      if (full && fresh.length) cueMascot({ say: toyLines.fullSet, move: 'hop', ms: 2400 });
      else if (fresh.length) cueMascot({ say: toyLines.newCards(fresh.length), move: 'hop' });
      else cueMascot({ say: toyLines.dupes, move: 'shake' });
    });
  };

  // The hand drops away and a new pack lands on the table.
  const clear = () => {
    if (state() !== 'open') return;
    setState('clearing');
    hand.forEach((card, i) => {
      if (!still.matches)
        card.animate([{ transform: 'none', opacity: 1 }, { transform: 'translateY(70px) scale(0.85)', opacity: 0 }], {
          duration: 280,
          delay: i * 60,
          easing: 'ease-in',
          fill: 'forwards',
        });
    });
    later(280 + hand.length * 60, () => {
      for (const card of hand) {
        card.hidden = true;
        card.dataset.face = 'down';
        card.removeAttribute('data-new');
        delete card.dataset.slot;
        for (const a of card.getAnimations()) a.cancel();
      }
      hand = [];
      setState('sealed');
      if (!still.matches) restart(pack, 'data-fresh');
    });
  };

  pack.addEventListener('click', tear);
  open.addEventListener('click', () => (state() === 'sealed' ? tear() : clear()));
  for (const slot of slots.values()) slot.addEventListener('animationend', () => slot.removeAttribute('data-new'));
  for (const chip of chips) chip.addEventListener('animationend', () => chip.removeAttribute('data-swapped'));

  // A new cartridge: the old one pops up, this one sinks in, and every card
  // that runs on a local model takes it at once.
  for (const cart of carts) {
    cart.addEventListener('click', () => {
      if (cart.getAttribute('aria-pressed') === 'true') return;
      for (const c of carts) c.setAttribute('aria-pressed', String(c === cart));
      const name = cart.dataset.name ?? '';
      for (const chip of chips) {
        chip.textContent = name;
        if (!chip.closest('[hidden]')) restart(chip, 'data-swapped');
      }
      const onIt = hand.filter((card) => card.querySelector('[data-brain-name]')).map((card) => card.dataset.label);
      live.textContent = onIt.length
        ? `${name} is in the phone; ${onIt.join(', ')} now run on it.`
        : `${name} is in the phone; every agent on a local model runs on it.`;
      cueMascot({ say: toyLines.brainIn(name), move: 'hop' });
    });
  }

  tiltCards(cards.values(), still);
}
