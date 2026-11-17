// The first shift's memory, kept in AsyncStorage: whether it was offered,
// is on or was waved off, each mission's mark, the finale and the reward
// (logic/starter/shift.ts decides). Which missions a phone gets is
// logic/starter/missions.ts, from the build and the phone. A mission's walk
// (Lead the way, ui/starter/walk/) is kept in memory only: a restart ends
// it.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import type { AgentId } from '../engine/agents/records';
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

/** Lead the way: the app pointing out the way to one mission's place, a tap at a time. */
export type ShiftWalk = {
  mission: MissionId;
  /** Carried to the walk's place: the terminal's command, typed in as it opens. */
  dare: string | null;
  /** The agent a walk through an agent's own screens goes with (Say hi, the terminal); null for one through the app's. */
  agentId: AgentId | null;
  /** The walk switched Home to that agent as it started. */
  switched: boolean;
  /** The chat is being typed in: the guide keeps out of the way until the stamp. */
  quiet: boolean;
  /** The mission was seen done on the way: the stamp shows. */
  done: boolean;
};

type StarterState = {
  hydrated: boolean;
  shift: ShiftState;
  walk: ShiftWalk | null;

  hydrate: () => Promise<void>;
  start: () => void;
  windOff: () => void;
  /** The app saw [id] happen; [missions] is this phone's list (for the reward). */
  markDone: (id: MissionId, missions: readonly MissionId[]) => void;
  skip: (id: MissionId) => void;
  unskip: (id: MissionId) => void;
  finish: () => void;
  restart: () => void;
  /** Lead the way on [mission], carrying [dare] to its place, with [agentId] (switched to as it starts); a walk already on gives way. */
  startWalk: (mission: MissionId, dare: string | null, agentId: AgentId | null, switched: boolean) => void;
  quietWalk: () => void;
  /** The walk got there: the stamp. */
  walkDone: () => void;
  endWalk: () => void;
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

  const walkDone = () => {
    const walk = get().walk;
    if (walk && !walk.done) set({ walk: { ...walk, done: true } });
  };

  return {
    hydrated: false,
    shift: FRESH,
    walk: null,

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
    windOff: () => {
      change(windOff);
      set({ walk: null });
    },
    markDone: (id, missions) => {
      const before = get().shift.marks[id];
      change((s) => markDone(s, id, missions));
      if (before !== 'done' && get().shift.marks[id] === 'done' && get().walk?.mission === id) walkDone();
    },
    skip: (id) => {
      change((s) => skip(s, id));
      if (get().walk?.mission === id) set({ walk: null });
    },
    unskip: (id) => change((s) => unskip(s, id)),
    finish: () => change(finish),
    restart: () => {
      change(restart);
      set({ walk: null });
    },

    startWalk: (mission, dare, agentId, switched) => set({ walk: { mission, dare, agentId, switched, quiet: false, done: false } }),
    quietWalk: () => {
      const walk = get().walk;
      if (walk && !walk.quiet) set({ walk: { ...walk, quiet: true } });
    },
    walkDone,
    endWalk: () => set({ walk: null }),
  };
});

/** The command a walk to [mission] carries, typed in where it leads; none without that walk. */
export function walkDare(mission: MissionId): string | undefined {
  const walk = useStarterStore.getState().walk;
  return walk?.mission === mission ? (walk.dare ?? undefined) : undefined;
}
