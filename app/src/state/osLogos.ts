// Docker Hub logos of the systems we have seen, by pull name, kept in
// AsyncStorage so the Systems list draws them without asking Hub again.
// Filled whenever a catalog list loads (Which Linux?), and from the official
// list once a run when Systems shows a system it has no logo for (a fresh
// install's Default system, Debian-based). Best-effort: no logo, the OS's
// letter.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { catalogOs } from '../engine/linux/native';
import type { CatalogImage } from '../engine/linux/types';

const KEY = 'phonecando.osLogos.v1';

interface OsLogosState {
  logos: Record<string, string>;
  hydrated: boolean;
  /** Reads the stored logos; later calls do nothing. */
  hydrate: () => Promise<void>;
  remember: (images: readonly CatalogImage[]) => void;
  /** Fetches the official list's logos, once a run. */
  fetchOfficial: () => void;
}

let hydrating: Promise<void> | null = null;
let fetchedOfficial = false;

export const useOsLogosStore = create<OsLogosState>((set, get) => ({
  logos: {},
  hydrated: false,

  hydrate: () => {
    hydrating ??= AsyncStorage.getItem(KEY)
      .then((raw) => {
        const stored = raw ? (JSON.parse(raw) as Record<string, string>) : {};
        // A list that loaded meanwhile wins.
        set((s) => ({ logos: { ...stored, ...s.logos }, hydrated: true }));
      })
      .catch(() => set({ hydrated: true }));
    return hydrating;
  },

  remember: (images) => {
    const found = images.filter((i): i is CatalogImage & { logoUrl: string } => i.logoUrl != null);
    const logos = get().logos;
    if (found.every((i) => logos[i.name] === i.logoUrl)) return;
    const next = { ...logos, ...Object.fromEntries(found.map((i) => [i.name, i.logoUrl])) };
    set({ logos: next });
    void get()
      .hydrate()
      .then(() => AsyncStorage.setItem(KEY, JSON.stringify(get().logos)))
      .catch(() => {
        // kept for this run
      });
  },

  fetchOfficial: () => {
    if (fetchedOfficial) return;
    fetchedOfficial = true;
    catalogOs()
      .then((list) => get().remember(list))
      .catch(() => {
        // offline or no Linux: letters it is
      });
  },
}));
