import { useEffect } from 'react';
import { useOsLogosStore } from '../../../state/osLogos';
import { pickLogo } from '../logic/osLogo';

/** A system's Docker Hub logo by its logo keys (logic/osLogo.ts), as the Which Linux? list shows it; null draws its letter. */
export function useSystemLogo(keys: readonly string[]): string | null {
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
