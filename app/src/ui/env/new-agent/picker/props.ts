import type { Look } from '../../../../../../mascot/look.ts';
import type { Offer } from '../../../../engine/agents/offers';

/** What every look of the Choose agent step is handed (AgentPicker.tsx). */
export type PickerProps = {
  offers: readonly Offer[];
  selected: string | null;
  onSelect: (kindId: string) => void;
  /** Each applicant's face, by kind id (useApplicantLooks.ts). */
  looks: Readonly<Record<string, Look>>;
};
