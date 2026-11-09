import { useMemo, useState } from 'react';
import { preselect, type Offer, type OfferEnv } from '../../../engine/agents/offers';
import { defaultKindId, offersForEnv } from '../../../state/flows/kindOffers';

export type OfferChoice = {
  offers: Offer[];
  /** The picked kind: the default one at first, when it can be made here. */
  selected: string | null;
  select: (kindId: string) => void;
};

// The kinds offered for an env and the one picked. A pick that the env's
// offers no longer allow (the env changed) falls back to the preselection.
export function useOffers(env: OfferEnv): OfferChoice {
  const { kind, family, ready } = env;
  const offers = useMemo(() => offersForEnv({ kind, family, ready }), [kind, family, ready]);
  const [picked, select] = useState<string | null>(null);
  const pickable = offers.some((o) => o.id === picked && o.blocked == null);
  const selected = pickable ? picked : preselect(offers, defaultKindId());
  return { offers, selected, select };
}
