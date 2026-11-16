import type { UserKindFile } from '../../../../engine/agents/user/native';
import type { CardMenuItem } from '../../../common/CardMenu';

/** One kind as its row draws it (KindRows.tsx). */
export type KindItem = {
  kind: UserKindFile;
  label: string;
  /** Agents made from it. */
  agents: number;
  menu: CardMenuItem[];
  /** Opens its form; null while it does not load. */
  onEdit: (() => void) | null;
};
