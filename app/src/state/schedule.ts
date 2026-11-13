// Schedules as the screens read them (engine/schedule/): every schedule
// (the drawer's row, an agent's Schedules row, the Schedules page),
// whether runs come on time, and, while a Schedules page is open, the
// runs log. The first refresh subscribes to the runner's changes and to
// the app coming back to the foreground (you may have just allowed
// alarms in Android's settings); a burst of changes reads once. Re-read
// records that did not change stay the same objects, so a row that shows
// one skips the render.
import { AppState } from 'react-native';
import { create } from 'zustand';
import type { AgentId } from '../engine/agents/records';
import { exactAlarms, listSchedules, onSchedules, scheduleRuns, schedulesAvailable } from '../engine/schedule/native';
import type { Schedule, ScheduleRun } from '../engine/schedule/types';
import { keepUnchangedList, sameValue } from './logic/keepUnchanged';

/** A burst of runner changes within this reads once. */
const SETTLE_MS = 150;

interface ScheduleState {
  /** This build has schedules (the runner lists them). */
  available: boolean;
  schedules: Schedule[];
  /** Newest first; read only while a Schedules page watches (empty before). */
  runs: ScheduleRun[];
  /** Runs come on time (Alarms & reminders allowed); null where the build can't tell. */
  exact: boolean | null;
  /** Re-reads the schedules and the alarms, and the runs while a page watches; subscribes once. */
  refreshSchedules: () => void;
  /** A Schedules page in front: reads the runs now and on each change, until the returned stop. */
  watchSchedules: () => () => void;
}

let subscribed = false;
let watchers = 0;
let pending: ReturnType<typeof setTimeout> | null = null;

/** The runs with each unchanged one kept as the same object. */
function keepRuns(prev: ScheduleRun[], next: ScheduleRun[]): ScheduleRun[] {
  const old = new Map(prev.map((r) => [r.seq, r]));
  const kept = next.map((r) => {
    const was = old.get(r.seq);
    return was !== undefined && sameValue(was, r) ? was : r;
  });
  const same = kept.length === prev.length && kept.every((r, i) => r === prev[i]);
  return same ? prev : kept;
}

export const useScheduleStore = create<ScheduleState>((set, get) => {
  const read = () => {
    const available = schedulesAvailable();
    const schedules = keepUnchangedList(get().schedules, listSchedules());
    const exact = exactAlarms();
    const next: Partial<ScheduleState> = {};
    if (available !== get().available) next.available = available;
    if (schedules !== get().schedules) next.schedules = schedules;
    if (exact !== get().exact) next.exact = exact;
    if (watchers > 0) {
      const runs = keepRuns(get().runs, scheduleRuns());
      if (runs !== get().runs) next.runs = runs;
    }
    if (Object.keys(next).length > 0) set(next);
  };

  const soon = () => {
    if (pending) return;
    pending = setTimeout(() => {
      pending = null;
      read();
    }, SETTLE_MS);
  };

  const subscribe = () => {
    if (subscribed) return;
    subscribed = true;
    onSchedules(soon);
    AppState.addEventListener('change', (state) => {
      if (state === 'active') soon();
    });
  };

  return {
    available: false,
    schedules: [],
    runs: [],
    exact: null,

    refreshSchedules: () => {
      subscribe();
      read();
    },

    watchSchedules: () => {
      subscribe();
      watchers++;
      read();
      let stopped = false;
      return () => {
        if (stopped) return;
        stopped = true;
        watchers--;
      };
    },
  };
});

/** How many schedules the agent has; re-renders only when that changes. */
export function useScheduleCount(agentId: AgentId): number {
  return useScheduleStore((s) => s.schedules.reduce((n, x) => (x.agentId === agentId ? n + 1 : n), 0));
}
