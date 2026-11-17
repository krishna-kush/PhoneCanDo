import { useMemo, useRef } from 'react';
import type { Look } from '../../../../../../mascot/look.ts';
import type { Offer } from '../../../../engine/agents/offers';
import { useMascotsStore } from '../../../../state/mascots';
import { applicantLooks } from './logic/applicants';

// The applicants' faces for this visit to the step (logic/applicants.ts):
// picked as it opens, unlike every agent's here, and kept while it is up;
// a kind that turns up meanwhile (a custom one just added) gets its own.
export function useApplicantLooks(offers: readonly Offer[]): Readonly<Record<string, Look>> {
  const ids = offers.map((o) => o.id).join('\n');
  const kept = useRef<Readonly<Record<string, Look>>>({});
  return useMemo(() => {
    const taken = Object.values(useMascotsStore.getState().looks);
    kept.current = applicantLooks(ids ? ids.split('\n') : [], kept.current, taken, Math.random);
    return kept.current;
  }, [ids]);
}
