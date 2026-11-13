// When this phone last changed each synced setting (theme, extra keys, the
// lite update offer, the run caps), kept in AsyncStorage so a change made
// while signed out still wins over an older one on the account later. The
// values themselves live where they always do (prefs, the native caps);
// flows/settingsSync.ts joins them with the account.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { SYNCED_KEYS, type SyncedKey } from './logic/settingsSync/keys';
import type { Stamps } from './logic/settingsSync/merge';

const STAMPS_KEY = 'phonecando.settingsStamps.v1';

type SettingsSyncState = {
  hydrated: boolean;
  stamps: Stamps;
  hydrate: () => Promise<void>;
  /** Records `keys` as changed at `at` (only ever later than what is kept). */
  stamp: (keys: readonly SyncedKey[], at: number) => void;
};

function readStamps(text: string | null): Stamps {
  const out: Stamps = {};
  try {
    const o = text ? (JSON.parse(text) as Record<string, unknown>) : {};
    for (const k of SYNCED_KEYS) {
      const v = o[k];
      if (typeof v === 'number' && Number.isFinite(v) && v > 0) out[k] = v;
    }
  } catch {
    // unreadable: as if nothing was ever changed here
  }
  return out;
}

function save(stamps: Stamps): void {
  AsyncStorage.setItem(STAMPS_KEY, JSON.stringify(stamps)).catch(() => {
    // kept for this run
  });
}

export const useSettingsSyncStore = create<SettingsSyncState>((set, get) => ({
  hydrated: false,
  stamps: {},
  hydrate: async () => {
    if (get().hydrated) return;
    let text: string | null = null;
    try {
      text = await AsyncStorage.getItem(STAMPS_KEY);
    } catch {
      // defaults for this run
    }
    // A stamp made before the read finished is newer than anything stored,
    // and was not written (it would have replaced the stored ones).
    const early = get().stamps;
    set({ hydrated: true, stamps: { ...readStamps(text), ...early } });
    if (Object.keys(early).length > 0) save(get().stamps);
  },
  stamp: (keys, at) => {
    if (keys.length === 0) return;
    const stamps = { ...get().stamps };
    for (const k of keys) if ((stamps[k] ?? 0) < at) stamps[k] = at;
    set({ stamps });
    if (get().hydrated) save(stamps);
  },
}));
