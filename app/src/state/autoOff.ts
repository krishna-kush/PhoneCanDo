import { create } from 'zustand';
import * as native from '../engine/autoOff';

// Auto off (engine/autoOff.ts), as the Settings box, its offer and an
// agent's Accessibility slip all see it: the switch, whether Auto off is
// what turned the service off, and whether its one-time offer is due (from
// the switch's first turn-on on this install). Native keeps all three;
// refresh reads them again, which the app does whenever it comes to the
// front, since Auto off acts while it is away.
interface AutoOffState {
  /** This build has Auto off. */
  available: boolean;
  on: boolean;
  turnedOff: boolean;
  offerDue: boolean;
  /** The last save did not stick. */
  failed: boolean;
  refresh: () => void;
  /** Saves the switch, which answers the offer too. */
  set: (on: boolean) => void;
  /** Answers the offer, leaving the switch as it is. */
  dropOffer: () => void;
}

// Read once as the store is made, so the first frame already shows the box.
export const useAutoOffStore = create<AutoOffState>((set, get) => ({
  available: native.canAutoOff(),
  on: native.autoOff(),
  turnedOff: native.wasAutoOff(),
  offerDue: native.autoOffOfferDue(),
  failed: false,
  refresh: () =>
    set({
      available: native.canAutoOff(),
      on: native.autoOff(),
      turnedOff: native.wasAutoOff(),
      offerDue: native.autoOffOfferDue(),
    }),
  set: (on) => {
    const kept = native.setAutoOff(on);
    set({ on: kept ?? get().on, failed: kept !== on, offerDue: native.autoOffOfferDue() });
  },
  dropOffer: () => {
    native.dropAutoOffOffer();
    set({ offerDue: false });
  },
}));
