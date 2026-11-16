import { create } from 'zustand';
import { type ThemeMode, useAppStore } from '../../../state/app';

/** One theme change on its way: the colour that sweeps over the app, from where it was tapped. */
export type Sweep = {
  id: number;
  mode: ThemeMode;
  /** The scheme it paints: the sweep is its background, lights on (A-01 wakes) or off (A-01 naps). */
  scheme: 'light' | 'dark';
  /** Where it was tapped, in window points. */
  x: number;
  y: number;
};

type State = {
  /** The theme just picked, shown as picked at once while the app catches up. */
  pending: ThemeMode | null;
  sweep: Sweep | null;
  /** Whether ThemeCurtain is mounted to play the sweep. */
  curtain: boolean;
  setCurtain: (on: boolean) => void;
  /** Applies `mode` behind a sweep, or on the next frame without one. */
  pick: (mode: ThemeMode, sweep: Omit<Sweep, 'id' | 'mode'> | null) => void;
  /** The sweep has covered the app: the theme goes in under it. */
  apply: (id: number) => void;
  done: (id: number) => void;
};

let next = 1;

// A theme change, in two steps so the tap stays quick: the screen shows as
// picked at once, then the whole-app re-render waits until the press is
// back up: under ThemeCurtain's sweep when it plays (it calls apply once
// the colour covers the app, done once it has faded), else a frame later.
// One at a time: a pick while a sweep runs is dropped.
export const useThemeSweep = create<State>((set, get) => ({
  pending: null,
  sweep: null,
  curtain: false,
  setCurtain: (curtain) => set({ curtain }),
  pick: (mode, sweep) => {
    if (get().sweep) return;
    if (!sweep || !get().curtain) {
      set({ pending: mode });
      requestAnimationFrame(() => {
        void useAppStore.getState().setThemeMode(mode);
        set({ pending: null });
      });
      return;
    }
    set({ pending: mode, sweep: { ...sweep, id: next++, mode } });
  },
  apply: (id) => {
    const sweep = get().sweep;
    if (sweep?.id === id) void useAppStore.getState().setThemeMode(sweep.mode);
  },
  done: (id) => {
    if (get().sweep?.id === id) set({ sweep: null, pending: null });
  },
}));
