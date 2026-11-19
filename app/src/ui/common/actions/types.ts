import type { SpotId } from '../spot/ids';
import type { DeckRole } from './logic/deal';

/** One button of a deck. */
export type DeckAction = {
  label: string;
  onPress: () => void;
  /** What it does on its page (logic/deal.ts); `more` when left out. */
  role?: DeckRole;
  /** Busy: no press, the small logo loader by the label. */
  loading?: boolean;
  disabled?: boolean;
  /** A spot a guide can point at (common/spot/). */
  spot?: SpotId | null;
};
