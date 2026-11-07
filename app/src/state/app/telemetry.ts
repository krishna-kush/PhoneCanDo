// Usage-stats flags mirrored from engine/telemetry for Settings → Privacy.
import type { StateCreator } from 'zustand';
import {
  getTelemetryState,
  startTelemetry,
  subscribeTelemetry,
  type TelemetryState,
} from '../../engine/telemetry';
import type { AppState } from '../app';

export type TelemetrySlice = {
  /** Usage-stats flags, mirrored from engine/telemetry after it starts. */
  telemetry: TelemetryState;
  /** Starts telemetry once (after hydrate) and keeps `telemetry` in sync. */
  startTelemetry: () => Promise<void>;
};

let subscribed = false;

export const createTelemetrySlice: StateCreator<AppState, [], [], TelemetrySlice> = (set) => ({
  telemetry: getTelemetryState(),

  startTelemetry: async () => {
    // Subscribed once: startTelemetry() itself only ever starts once.
    if (!subscribed) {
      subscribed = true;
      subscribeTelemetry(() => set({ telemetry: getTelemetryState() }));
    }
    set({ telemetry: await startTelemetry() });
  },
});
