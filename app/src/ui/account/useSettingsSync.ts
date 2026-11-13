import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useAppStore } from '../../state/app';
import { syncSettingsWithAccount, watchSettingChanges } from '../../state/flows/settingsSync';

// A signed-in person's settings follow them (flows/settingsSync.ts): from the
// moment the stored prefs are read, every change is stamped and sent, and
// the account's newer settings are taken at launch and whenever the app
// comes back to the front. Signed out, the stamps are kept and nothing is sent.
export function useSettingsSync(): void {
  const prefsHydrated = useAppStore((s) => s.hydrated);

  useEffect(() => {
    if (!prefsHydrated) return;
    const stop = watchSettingChanges();
    void syncSettingsWithAccount();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void syncSettingsWithAccount();
    });
    return () => {
      stop();
      sub.remove();
    };
  }, [prefsHydrated]);
}
