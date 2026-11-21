import { create } from 'zustand';
import * as native from '../engine/autoOff';

// Auto off (engine/autoOff.ts), as the Settings box and an agent's
// Accessibility slip see it: the switch, and whether Auto off is what
// turned the service off. Native keeps both; refresh reads them again,
// which the app does whenever it comes to the front, since Auto off acts
// while it is away.
interface AutoOffState {
  /** This build has Auto off. */
  available: boolean;
  on: boolean;
  turnedOff: boolean;
  /** The last save did not stick. */
  failed: boolean;
  refresh: () => void;
  /** Saves the switch. */
  set: (on: boolean) => void;
}

// Read once as the store is made, so the first frame already shows the box.
export const useAutoOffStore = create<AutoOffState>((set, get) => ({
  available: native.canAutoOff(),
  on: native.autoOff(),
  turnedOff: native.wasAutoOff(),
  failed: false,
  refresh: () =>
    set({
      available: native.canAutoOff(),
      on: native.autoOff(),
      turnedOff: native.wasAutoOff(),
    }),
  set: (on) => {
    const kept = native.setAutoOff(on);
    set({ on: kept ?? get().on, failed: kept !== on });
  },
}));
