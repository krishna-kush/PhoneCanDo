// The first shift's memory, kept in AsyncStorage: whether it was offered,
// is on or was waved off, each mission's mark, the finale and the reward
// (logic/starter/shift.ts decides). Which missions a phone gets is
// logic/starter/missions.ts, from the build and the phone.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import type { MissionId } from './logic/starter/missions';
import {
  finish,
  FRESH,
  markDone,
  parseShift,
  restart,
  skip,
  start,
  unskip,
  windOff,
  type ShiftState,
} from './logic/starter/shift';

const KEY = 'phonecando.starter.v1';

type StarterState = {
  hydrated: boolean;
  shift: ShiftState;

  hydrate: () => Promise<void>;
  start: () => void;
  windOff: () => void;
  /** The app saw [id] happen; [missions] is this phone's list (for the reward). */
  markDone: (id: MissionId, missions: readonly MissionId[]) => void;
  skip: (id: MissionId) => void;
  unskip: (id: MissionId) => void;
  finish: () => void;
  restart: () => void;
};

// Best-effort: the in-memory state applies for this run.
function save(shift: ShiftState) {
  AsyncStorage.setItem(KEY, JSON.stringify(shift)).catch(() => {});
}

export const useStarterStore = create<StarterState>((set, get) => {
  // Before the stored state is read, a change would overwrite it.
  const change = (next: (s: ShiftState) => ShiftState) => {
    if (!get().hydrated) return;
    const before = get().shift;
    const shift = next(before);
    if (shift === before) return;
    set({ shift });
    save(shift);
  };

  return {
    hydrated: false,
    shift: FRESH,

    hydrate: async () => {
      if (get().hydrated) return;
      let raw: string | null = null;
      try {
        raw = await AsyncStorage.getItem(KEY);
      } catch {
        // unreadable: start fresh
      }
      set({ shift: parseShift(raw), hydrated: true });
    },

    start: () => change(start),
    windOff: () => change(windOff),
    markDone: (id, missions) => change((s) => markDone(s, id, missions)),
    skip: (id) => change((s) => skip(s, id)),
    unskip: (id) => change((s) => unskip(s, id)),
    finish: () => change(finish),
    restart: () => change(restart),
  };
});
