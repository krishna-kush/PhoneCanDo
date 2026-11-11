// The runner's memory guard as the screens read it (engine/memory.ts): the
// last reading, whether the RAM warning is up, and an automatic stop still
// to tell. Each reading goes through logic/memoryEpisode.ts, which decides
// when the warning opens by itself (once per episode, once more if it
// turns critical), so it never nags. Hydrated once; from then on every
// native reading lands here, and a stop from the warning re-reads at once.
import { create } from 'zustand';
import { MEMORY_OK, memoryStatus, onMemory, type AutoStop, type MemoryStatus } from '../engine/memory';
import { foldReading, NO_EPISODE, type Episode } from './logic/memoryEpisode';

interface MemoryState {
  status: MemoryStatus;
  episode: Episode;
  /** The RAM warning is up. */
  sheetOpen: boolean;
  /** An automatic stop to tell until the toast goes; null for none. */
  told: AutoStop | null;
  /** Reads the guard and subscribes to its readings; later calls only re-read. */
  hydrateMemory: () => void;
  /** Re-reads the guard now (after a stop, on the way back to the app). */
  refreshMemory: () => void;
  /** Opens the warning, at any level (Settings and the pill open it too). */
  openSheet: () => void;
  /**
   * "I'll handle it": the warning goes, the pill keeps the countdown in
   * sight. An automatic stop it told goes with it (no toast after).
   */
  closeSheet: () => void;
  dismissTold: () => void;
}

let subscribed = false;

export const useMemoryStore = create<MemoryState>((set, get) => {
  const apply = (status: MemoryStatus) => {
    const fold = foldReading(get().episode, status, Date.now());
    set((s) => ({
      status,
      episode: fold.episode,
      sheetOpen: s.sheetOpen || fold.open,
      told: fold.told ?? s.told,
    }));
  };

  return {
    status: MEMORY_OK,
    episode: NO_EPISODE,
    sheetOpen: false,
    told: null,

    hydrateMemory: () => {
      if (!subscribed) {
        subscribed = true;
        onMemory(apply);
      }
      apply(memoryStatus());
    },

    refreshMemory: () => apply(memoryStatus()),

    openSheet: () => set({ sheetOpen: true }),

    closeSheet: () => set({ sheetOpen: false, told: null }),

    dismissTold: () => set({ told: null }),
  };
});
