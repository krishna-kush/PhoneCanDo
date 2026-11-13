// Telling a friend: the links this phone shared (kept in AsyncStorage,
// logic/share/list.ts), whether an install from a friend's link was
// counted here, and what each tracked link did (in memory, read from the
// server by flows/share.ts when the Refer page is in front).
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import type { AccountShareLink } from '../engine/account';
import type { LinkStats } from '../engine/share/stats';
import { addLink, EMPTY, mergeAccount, parseKept, type ShareKept, type ShareLink } from './logic/share/list';

const KEY = 'phonecando.share.v1';

export type StatsStatus = 'idle' | 'loading' | 'failed';

type ShareState = ShareKept & {
  hydrated: boolean;
  /** What each tracked link did, by code. */
  stats: Record<string, LinkStats>;
  statsStatus: StatsStatus;
  /** When the stats were last read (ms), or null. */
  statsAt: number | null;

  hydrate: () => Promise<void>;
  addLink: (link: ShareLink) => void;
  /** Joins the account's list in (codes shared from another phone). */
  mergeAccount: (account: readonly AccountShareLink[]) => void;
  markInstallCounted: () => void;
  setStatsStatus: (status: StatsStatus) => void;
  setStats: (stats: Record<string, LinkStats>, at: number) => void;
};

// Best-effort: the in-memory state applies for this run.
function save(kept: ShareKept) {
  AsyncStorage.setItem(KEY, JSON.stringify(kept)).catch(() => {});
}

let hydrating: Promise<void> | null = null;

export const useShareStore = create<ShareState>((set, get) => {
  function keep(next: Partial<ShareKept>) {
    const kept: ShareKept = { links: next.links ?? get().links, installCounted: next.installCounted ?? get().installCounted };
    set(kept);
    // why only once read: a save before that would overwrite what is kept.
    if (get().hydrated) save(kept);
  }

  return {
    ...EMPTY,
    hydrated: false,
    stats: {},
    statsStatus: 'idle',
    statsAt: null,

    hydrate: () => {
      if (get().hydrated) return Promise.resolve();
      hydrating ??= (async () => {
        let raw: string | null = null;
        try {
          raw = await AsyncStorage.getItem(KEY);
        } catch {
          // unreadable: start empty
        }
        const kept = parseKept(raw);
        // What was added before the read finished stays, and is kept now.
        const early = get();
        const merged: ShareKept = {
          links: early.links.reduce(addLink, kept.links),
          installCounted: kept.installCounted || early.installCounted,
        };
        set({ ...merged, hydrated: true });
        if (early.links.length > 0 || early.installCounted) save(merged);
      })();
      return hydrating;
    },

    addLink: (link) => keep({ links: addLink(get().links, link) }),
    mergeAccount: (account) => keep({ links: mergeAccount(get().links, account) }),
    markInstallCounted: () => keep({ installCounted: true }),
    setStatsStatus: (statsStatus) => set({ statsStatus }),
    setStats: (stats, at) => set({ stats, statsAt: at, statsStatus: 'idle' }),
  };
});
