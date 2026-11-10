import { useMemo, useState } from 'react';
import { preselect, type Offer, type OfferEnv } from '../../../engine/agents/offers';
import { defaultKindId, offersForEnv } from '../../../state/flows/kindOffers';
import { useKindsStore } from '../../../state/kinds';

export type OfferChoice = {
  offers: Offer[];
  /** The picked kind: `initial` or the default one at first, when it can be made here. */
  selected: string | null;
  select: (kindId: string) => void;
};

// The kinds offered for an env and the one picked. A pick that the env's
// offers no longer allow (the env changed, the kind was deleted) falls back
// to the preselection. A custom kind saved or deleted meanwhile shows at once.
export function useOffers(env: OfferEnv, initial: string | null = null): OfferChoice {
  const { kind, family, ready } = env;
  const kindsVersion = useKindsStore((s) => s.version);
  // kindsVersion: the kinds changed, so read them again.
  const offers = useMemo(() => offersForEnv({ kind, family, ready }), [kind, family, ready, kindsVersion]);
  const [picked, select] = useState<string | null>(initial);
  const pickable = offers.some((o) => o.id === picked && o.blocked == null);
  const selected = pickable ? picked : preselect(offers, defaultKindId());
  return { offers, selected, select };
}
