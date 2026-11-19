// How a stack of a page's buttons is laid out as one deck (ActionDeck).
// Pure (zero RN imports).

/**
 * What a button does on its page:
 * - `go`: the page's one main act (Save, Add agent), a wide key first;
 * - `more`: another act (Run now, Open chat), half-width keys in pairs;
 * - `back`: leaves without doing anything (Cancel, Back), the last key of
 *   the pairs;
 * - `danger`: can't be undone (Delete), on its own, under a rule.
 */
export type DeckRole = 'go' | 'more' | 'back' | 'danger';

export type Dealt<A> = {
  go: A[];
  more: A[];
  back: A[];
  danger: A[];
};

/** Lays the buttons out by role, each group keeping the page's order; null entries (a button the page hides) drop. */
export function deal<A extends { role?: DeckRole }>(actions: readonly (A | null | false | undefined)[]): Dealt<A> {
  const shown = actions.filter((a): a is A => !!a);
  const of = (role: DeckRole) => shown.filter((a) => (a.role ?? 'more') === role);
  return { go: of('go'), more: of('more'), back: of('back'), danger: of('danger') };
}

/** The longest label that fits a half-width key on a narrow phone, in mono capitals. */
export const PAIR_CHARS = 13;

/**
 * Keys two to a row, in order, when both labels are short enough
 * (PAIR_CHARS); a longer one takes a row the deck's width, and so does a
 * short one left over.
 */
export function pairsOf<A extends { label: string }>(keys: readonly A[]): A[][] {
  const rows: A[][] = [];
  let open: A | null = null;
  for (const k of keys) {
    if (k.label.length > PAIR_CHARS) {
      if (open) rows.push([open]);
      open = null;
      rows.push([k]);
    } else if (open) {
      rows.push([open, k]);
      open = null;
    } else {
      open = k;
    }
  }
  if (open) rows.push([open]);
  return rows;
}
