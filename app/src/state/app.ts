// App-wide UI state, one store from three slices: navigation (the page
// stack over Home, the drawer, terminals), prefs (persisted choices) and
// telemetry flags. Agents and the active agent live in agents.ts.
import { create } from 'zustand';
import { createNavigationSlice, type NavigationSlice } from './app/navigation';
import { createPrefsSlice, type PrefsSlice } from './app/prefs';
import { createTelemetrySlice, type TelemetrySlice } from './app/telemetry';

export { selectTerminal } from './app/navigation';
export type { NewAgentTarget, PickedTag, Route, TerminalSession } from './app/routes';
export type { ThemeMode } from './app/prefs';

export type AppState = NavigationSlice & PrefsSlice & TelemetrySlice;

export const useAppStore = create<AppState>()((...a) => ({
  ...createNavigationSlice(...a),
  ...createPrefsSlice(...a),
  ...createTelemetrySlice(...a),
}));
