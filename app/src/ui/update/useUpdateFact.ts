import { useMemo } from 'react';
import { fractionOf, type UpdateStep } from '../../state/logic/update/steps';
import { useUpdateStore } from '../../state/update';

type UpdateFact = { version: string; step: UpdateStep | null; pct: number | null };

/** The newer build, where its update stands and its download's whole percent; null when none is known. */
export function useUpdateFact(): UpdateFact | null {
  const version = useUpdateStore((s) => s.manifest?.version ?? null);
  const step = useUpdateStore((s) => s.step);
  const pct = useUpdateStore((s) => {
    const f = fractionOf(s.progress.written, s.progress.total);
    return f == null ? null : Math.floor(f * 100);
  });
  return useMemo(() => (version ? { version, step, pct } : null), [version, step, pct]);
}
