import { useEffect, useMemo } from 'react';
import type { Env } from '../../../engine/linux/types';
import { useOsLogosStore } from '../../../state/osLogos';
import { logoKeys, pickLogo } from '../logic/osLogo';

/** A system's Docker Hub logo, as the Which Linux? list shows it; null draws its letter. */
export function useSystemLogo(env: Env | null): string | null {
  const keys = useMemo(() => (env ? logoKeys(env) : []), [env]);
  const logos = useOsLogosStore((s) => s.logos);
  const hydrated = useOsLogosStore((s) => s.hydrated);
  const logo = pickLogo(keys, logos);

  useEffect(() => {
    void useOsLogosStore.getState().hydrate();
  }, []);

  // None on file yet (a fresh install's Default system): ask Hub's official list, once a run.
  useEffect(() => {
    if (hydrated && !logo && keys.length > 0) useOsLogosStore.getState().fetchOfficial();
  }, [hydrated, logo, keys.length]);

  return logo;
}
