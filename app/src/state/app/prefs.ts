// The user's app-wide choices, kept in AsyncStorage: theme, the terminal's
// extra keys, the update offer (lite's switch, the build already offered at
// a launch), the restricted-settings guide's progress, whether first
// launch's setup has run on this phone and the license version agreed to.
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { StateCreator } from 'zustand';
import type { AppState } from '../app';
import { licenseAgreement, readLicenseAgreed, type LicenseAgreed } from '../logic/licenseAgreed';

export type ThemeMode = 'system' | 'light' | 'dark';

const THEME_MODE_KEY = 'phonecando.themeMode.v1';
const EXTRA_KEYS_STICKY_KEY = 'phonecando.extraKeysSticky.v1';
const UPDATE_PROMPT_MUTED_KEY = 'phonecando.updatePromptMuted.v1';
const UPDATE_OFFERED_KEY = 'phonecando.updateOffered.v1';
const A11Y_STEP_KEY = 'phonecando.a11yStep.v3';
const SET_UP_KEY = 'phonecando.setUp.v1';
const LICENSE_AGREED_KEY = 'phonecando.licenseAgreed.v1';

export type PrefsSlice = {
  hydrated: boolean;
  /** UI palette: follow the system or pin light/dark. */
  themeMode: ThemeMode;
  /** The terminal's extra keys stay up with the keyboard down too (else they come and go with it). */
  extraKeysSticky: boolean;
  /** Lite: stop opening the full-build pitch on launch (Settings → Updates). */
  updatePromptMuted: boolean;
  /** The newest versionCode the update box opened for by itself at a launch (0: none); this phone only. */
  updateOffered: number;
  /**
   * Restricted-settings guide progress: 1 Android's note, 2 App info (Allow
   * restricted settings), 3 the Accessibility switch.
   */
  a11yStep: 1 | 2 | 3;
  /**
   * The user hit Android's "Restricted setting" refusal while the plain flow
   * was showing: run the guide anyway. In-memory only.
   */
  a11yGuideForced: boolean;
  /**
   * First launch's setup has run on this phone, or an agent was ever here:
   * it never runs again, and with every agent deleted Home offers a new
   * one instead. This phone only.
   */
  setUp: boolean;
  /**
   * The license version this install agreed to, and when; null: never
   * (the license gate is up, ui/terms/). This install only, never synced.
   */
  licenseAgreed: LicenseAgreed | null;

  hydrate: () => Promise<void>;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  setExtraKeysSticky: (sticky: boolean) => Promise<void>;
  setUpdatePromptMuted: (muted: boolean) => Promise<void>;
  setUpdateOffered: (versionCode: number) => Promise<void>;
  setA11yStep: (step: 1 | 2 | 3) => Promise<void>;
  setA11yGuideForced: (forced: boolean) => void;
  /** Setup has run (or an agent is here): for good. */
  markSetUp: () => Promise<void>;
  /** I agree, on the license gate: to [version], now. */
  agreeToLicense: (version: string) => Promise<void>;
};

// Persistence is best-effort: the in-memory value applies for this run.
async function save(key: string, value: string): Promise<void> {
  try {
    await AsyncStorage.setItem(key, value);
  } catch {
    // keep the in-memory choice
  }
}

export const createPrefsSlice: StateCreator<AppState, [], [], PrefsSlice> = (set) => ({
  hydrated: false,
  themeMode: 'system',
  extraKeysSticky: false,
  updatePromptMuted: false,
  updateOffered: 0,
  a11yStep: 1,
  a11yGuideForced: false,
  setUp: false,
  licenseAgreed: null,

  hydrate: async () => {
    // The launch splash waits for this (the first frame's theme), so a read
    // failure still ends in hydrated, on the defaults.
    let stored: readonly (readonly [string, string | null])[] = [];
    try {
      stored = await AsyncStorage.multiGet([THEME_MODE_KEY, EXTRA_KEYS_STICKY_KEY, UPDATE_PROMPT_MUTED_KEY, A11Y_STEP_KEY, UPDATE_OFFERED_KEY, SET_UP_KEY, LICENSE_AGREED_KEY]);
    } catch {
      // unreadable: defaults for this run
    }
    const [theme, sticky, muted, step, offered, setUp, agreed] = stored.map(([, v]) => v);
    set({
      themeMode: theme === 'light' || theme === 'dark' ? theme : 'system',
      extraKeysSticky: sticky === '1',
      updatePromptMuted: muted === '1',
      updateOffered: Number.parseInt(offered ?? '0', 10) || 0,
      a11yStep: step === '2' ? 2 : step === '3' ? 3 : 1,
      setUp: setUp === '1',
      licenseAgreed: readLicenseAgreed(agreed),
      hydrated: true,
    });
  },

  setThemeMode: async (themeMode) => {
    set({ themeMode });
    await save(THEME_MODE_KEY, themeMode);
  },

  setExtraKeysSticky: async (extraKeysSticky) => {
    set({ extraKeysSticky });
    await save(EXTRA_KEYS_STICKY_KEY, extraKeysSticky ? '1' : '0');
  },

  setUpdatePromptMuted: async (updatePromptMuted) => {
    set({ updatePromptMuted });
    await save(UPDATE_PROMPT_MUTED_KEY, updatePromptMuted ? '1' : '0');
  },

  setUpdateOffered: async (updateOffered) => {
    set({ updateOffered });
    await save(UPDATE_OFFERED_KEY, String(updateOffered));
  },

  setA11yStep: async (a11yStep) => {
    set({ a11yStep });
    await save(A11Y_STEP_KEY, String(a11yStep));
  },

  setA11yGuideForced: (a11yGuideForced) => set({ a11yGuideForced }),

  markSetUp: async () => {
    set({ setUp: true });
    await save(SET_UP_KEY, '1');
  },

  agreeToLicense: async (version) => {
    const licenseAgreed = licenseAgreement(version, new Date());
    set({ licenseAgreed });
    await save(LICENSE_AGREED_KEY, JSON.stringify(licenseAgreed));
  },
});
