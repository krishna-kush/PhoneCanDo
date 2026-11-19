// Auto off for the pages that show it (the Settings box, an agent's
// Accessibility slip): the shared store (state/autoOff.ts), read again as
// the page mounts and whenever the app comes back to the front, since Auto
// off acts while it is away.
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useAutoOffStore } from '../../../state/autoOff';

export type AutoOff = ReturnType<typeof useAutoOff>;

export function useAutoOff() {
  const available = useAutoOffStore((s) => s.available);
  const on = useAutoOffStore((s) => s.on);
  const turnedOff = useAutoOffStore((s) => s.turnedOff);
  const failed = useAutoOffStore((s) => s.failed);

  useEffect(() => {
    const { refresh } = useAutoOffStore.getState();
    refresh();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => sub.remove();
  }, []);

  const set = (next: boolean) => useAutoOffStore.getState().set(next);
  return { available, on, turnedOff, failed, set, toggle: () => set(!on) };
}
