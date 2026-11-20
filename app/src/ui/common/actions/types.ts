import type { SpotId } from '../spot/ids';
import type { DeckRole } from './logic/deal';

/**
 * The main key's mark (KeyGlyph), by what it does: `play` starts or runs
 * something (Start, Retry), `terminal` opens one, `add` adds or makes one
 * more, `save` saves or agrees, `next` (an arrow) anything else.
 */
export type KeyMark = 'play' | 'terminal' | 'add' | 'save' | 'next';

/** One button of a deck. */
export type DeckAction = {
  label: string;
  onPress: () => void;
  /** What it does on its page (logic/deal.ts); `more` when left out. */
  role?: DeckRole;
  /** A `go` key's mark; `next` when left out, none when null (a long label that says enough). */
  mark?: KeyMark | null;
  /** Busy: no press, the small logo loader by the label. */
  loading?: boolean;
  disabled?: boolean;
  /** A spot a guide can point at (common/spot/). */
  spot?: SpotId | null;
};
