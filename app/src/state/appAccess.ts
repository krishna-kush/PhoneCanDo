import { create } from 'zustand';
import * as native from '../engine/appAccess';
import type { AppAccessApp, AppAccessState } from '../engine/appAccess';

// App access (engine/appAccess.ts), as Settings and the app question see
// it: the Allow all apps switch and every app answered Always or No. Native
// keeps both; refresh reads them again, which the pages do as they come to
// the front and after each answer, since an agent's question changes the
// list from anywhere.
interface AppAccessStore {
  /** This build asks before agents use an app (full builds). */
  available: boolean;
  allowAll: boolean;
  /** Sorted by label. */
  apps: AppAccessApp[];
  refresh: () => void;
  /** Saves one app (always right after biometrics; none: asked again); false when it did not stick. */
  set: (pkg: string, state: AppAccessState | 'none') => boolean;
  /** Saves Allow all apps (on right after biometrics); false when it did not stick. */
  setAllowAll: (on: boolean) => boolean;
}

function read() {
  const list = native.appAccessList();
  return { available: native.canAppAccess(), allowAll: list.allowAll, apps: list.apps };
}

// Read once as the store is made, so the first frame already shows the row.
export const useAppAccessStore = create<AppAccessStore>((set) => ({
  ...read(),
  refresh: () => set(read()),
  set: (pkg, state) => {
    const ok = native.setAppAccess(pkg, state);
    set(read());
    return ok;
  },
  setAllowAll: (on) => {
    const kept = native.setAllowAllApps(on);
    set(read());
    return kept === on;
  },
}));
