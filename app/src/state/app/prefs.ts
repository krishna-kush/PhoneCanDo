// The user's app-wide choices, kept in AsyncStorage: theme, the terminal's
// extra keys, the lite build's update offer and the restricted-settings
// guide's progress.
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { StateCreator } from 'zustand';
import type { AppState } from '../app';

export type ThemeMode = 'system' | 'light' | 'dark';

const THEME_MODE_KEY = 'phonecando.themeMode.v1';
const EXTRA_KEYS_STICKY_KEY = 'phonecando.extraKeysSticky.v1';
const UPDATE_PROMPT_MUTED_KEY = 'phonecando.updatePromptMuted.v1';
const A11Y_STEP_KEY = 'phonecando.a11yStep.v3';

export type PrefsSlice = {
  hydrated: boolean;
  /** UI palette: follow the system or pin light/dark. */
  themeMode: ThemeMode;
  /** The terminal's extra keys stay up with the keyboard down too (else they come and go with it). */
  extraKeysSticky: boolean;
  /** Bumped by Settings → Updates; UpdateDialog re-checks GitHub on change. */
  updatePromptNonce: number;
  /** Lite: stop opening the full-build pitch on launch (Settings → Updates). */
  updatePromptMuted: boolean;
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

  hydrate: () => Promise<void>;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  setExtraKeysSticky: (sticky: boolean) => Promise<void>;
  requestUpdatePrompt: () => void;
  setUpdatePromptMuted: (muted: boolean) => Promise<void>;
  setA11yStep: (step: 1 | 2 | 3) => Promise<void>;
  setA11yGuideForced: (forced: boolean) => void;
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
  updatePromptNonce: 0,
  updatePromptMuted: false,
  a11yStep: 1,
  a11yGuideForced: false,

  hydrate: async () => {
    const stored = await AsyncStorage.multiGet([THEME_MODE_KEY, EXTRA_KEYS_STICKY_KEY, UPDATE_PROMPT_MUTED_KEY, A11Y_STEP_KEY]);
    const [theme, sticky, muted, step] = stored.map(([, v]) => v);
    set({
      themeMode: theme === 'light' || theme === 'dark' ? theme : 'system',
      extraKeysSticky: sticky === '1',
      updatePromptMuted: muted === '1',
      a11yStep: step === '2' ? 2 : step === '3' ? 3 : 1,
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

  requestUpdatePrompt: () => set((s) => ({ updatePromptNonce: s.updatePromptNonce + 1 })),

  setUpdatePromptMuted: async (updatePromptMuted) => {
    set({ updatePromptMuted });
    await save(UPDATE_PROMPT_MUTED_KEY, updatePromptMuted ? '1' : '0');
  },

  setA11yStep: async (a11yStep) => {
    set({ a11yStep });
    await save(A11Y_STEP_KEY, String(a11yStep));
  },

  setA11yGuideForced: (a11yGuideForced) => set({ a11yGuideForced }),
});
