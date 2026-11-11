// What a change of the page stack does on screen, as pure data (zero RN
// imports; scripts/vectors/test_nav_stack.js checks it): which layers are
// drawn, which one enters or leaves over which, and each layer's part.
// transitionStore.ts applies it the moment the stack changes; motion.ts
// says how each part moves.
import type { Page } from '../../state/app/stack';
import type { LayerRole } from './motion';

/** Home's layer key: always drawn, at the bottom. */
export const HOME = 'home';

export type Anim = { id: number } & (
  /** A page opened over `under`; `kept` is a page no longer in the stack (replaced) shown as `under` until the end. */
  | { kind: 'push'; top: string; under: string; kept: Page | null }
  /** The top page went: `leaving` (out of the stack already) slides off over `reveal`. */
  | { kind: 'pop'; leaving: Page; reveal: string }
);

/** The stack as drawn: the pages, and the motion between the last two states while it runs. */
export type Shown = { pages: readonly Page[]; anim: Anim | null };

/** One layer on screen: Home (page null) or a page, and its part in the motion. */
export type Layer = { key: string; page: Page | null; role: LayerRole };

/** What one change of the stack does. */
export type Step =
  /** Nothing to draw differently. */
  | { kind: 'none' }
  /** The same page stays on top (pages under it changed): no motion; `rest` when nothing is moving. */
  | { kind: 'same'; shown: Shown; rest: boolean }
  /** A page that was not drawn opens on top. */
  | { kind: 'push'; shown: Shown; anim: Extract<Anim, { kind: 'push' }> }
  /** The top page goes and one already drawn comes back. */
  | { kind: 'pop'; shown: Shown; anim: Extract<Anim, { kind: 'pop' }> }
  /** Nothing was on top to move: the new stack shows at rest. */
  | { kind: 'rest'; shown: Shown };

export const keyOf = (page: Page | null | undefined): string => (page ? String(page.key) : HOME);
export const topOf = (pages: readonly Page[]): string => keyOf(pages[pages.length - 1]);
/** The layer right under the top one ('' with Home on top). */
export const belowOf = (pages: readonly Page[]): string => (pages.length > 0 ? keyOf(pages[pages.length - 2]) : '');

/**
 * The step from what is drawn (`prev`) to a new stack. A change while a
 * motion runs starts the next one from where things are: the page that was
 * leaving or entering is no longer drawn unless it is part of the new one.
 */
export function stepFor(prev: Shown, pages: readonly Page[], id: number): Step {
  const from = topOf(prev.pages);
  const to = topOf(pages);
  if (from === to) {
    if (prev.pages === pages) return { kind: 'none' };
    return { kind: 'same', shown: { pages, anim: prev.anim }, rest: !prev.anim };
  }
  const prevTop = prev.pages[prev.pages.length - 1] ?? null;
  const known = to === HOME || prev.pages.some((p) => keyOf(p) === to);
  if (!known) {
    const kept = prevTop && !pages.some((p) => p.key === prevTop.key) ? prevTop : null;
    const anim = { id, kind: 'push' as const, top: to, under: from, kept };
    return { kind: 'push', shown: { pages, anim }, anim };
  }
  if (!prevTop) return { kind: 'rest', shown: { pages, anim: null } };
  const anim = { id, kind: 'pop' as const, leaving: prevTop, reveal: to };
  return { kind: 'pop', shown: { pages, anim }, anim };
}

/** Every layer to draw, bottom first: Home, the pages, a replaced page kept under a push, a page still leaving. */
export function layersOf({ pages, anim }: Shown): Layer[] {
  const drawn: (Page | null)[] = [null, ...pages];
  if (anim?.kind === 'push' && anim.kept) drawn.splice(drawn.length - 1, 0, anim.kept);
  if (anim?.kind === 'pop') drawn.push(anim.leaving);
  const top = keyOf(drawn[drawn.length - 1]);
  return drawn.map((page) => ({ key: keyOf(page), page, role: partOf(keyOf(page), top, anim) }));
}

/** One layer's part (for touches and focus; the motion itself reads the UI thread's state). */
export function roleIn(shown: Shown, key: string): LayerRole {
  const top = shown.anim?.kind === 'pop' ? keyOf(shown.anim.leaving) : topOf(shown.pages);
  return partOf(key, top, shown.anim);
}

function partOf(key: string, top: string, anim: Anim | null): LayerRole {
  if (!anim) return key === top ? 'top' : 'hidden';
  if (anim.kind === 'push') return key === anim.top ? 'enter' : key === anim.under ? 'exit' : 'hidden';
  return key === keyOf(anim.leaving) ? 'leave' : key === anim.reveal ? 'reveal' : 'hidden';
}
