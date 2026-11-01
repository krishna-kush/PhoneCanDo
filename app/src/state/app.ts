import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { stopServeService } from '../engine/runner';
import {
  getPrefix,
  isAutomationEnabled,
  isRunnerAvailable,
  startServeService,
} from '../engine/runner';
import { listSessions, waitForEngine } from '../engine/sessions';
import { DEFAULT_ENV, loadEnvs, saveEnvs, type Env } from './envs';

export type FooterTab = 'home' | 'env' | 'settings';
export type ThemeMode = 'system' | 'light' | 'dark';

const ENGINE_PORT_KEY = 'phonecando.enginePort.v1';
const THEME_MODE_KEY = 'phonecando.themeMode.v1';

// Quiet-when-idle stop: runs ONLY when the app UI goes away (backgrounded;
// swipe-kill is covered by the service self-stop backstop). The stop veto is
// recency only: anything touched in the last minute (live generation bumps
// `time.updated`) keeps the engine. Errors mean unreachable → also stop.
async function stopEngineIfIdle(port: string): Promise<void> {
  // Phone control unlocked means the agent may be driving another app while
  // PhoneCanDo is backgrounded (mobile_home/launch); killing serve here strands the
  // turn before the next tool call. Quiet shutdown resumes after lock/reset.
  if (isAutomationEnabled()) return;
  const stop = () => {
    try {
      stopServeService();
    } catch {
      // already down
    }
  };
  try {
    const sessions = await listSessions(port);
    const recent = sessions.some((s) => (s.time?.updated ?? 0) > Date.now() - 60_000);
    if (!recent) stop();
  } catch {
    stop();
  }
}

export const DEFAULT_ENGINE_PORT = '4097';

interface AppState {
  envs: Env[];
  activeEnvId: string;
  footerTab: FooterTab;
  hydrated: boolean;
  enginePort: string;
  /** UI palette: follow the system or pin light/dark. */
  themeMode: ThemeMode;
  /** Folder-mode terminal: explicit directory the TUI is attached to
      (picked from the folder tree). Null = closed. */
  terminalDir: string | null;
  /** Folder picker overlay (TUI entry point). */
  folderPickerOpen: boolean;
  /** Web view can go back to the opencode home/project list. */
  webCanGoBack: boolean;

  hydrate: () => Promise<void>;
  setEnginePort: (port: string) => Promise<void>;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  setActiveEnv: (envId: string) => Promise<void>;
  addEnv: (name: string, directory: string) => Promise<void>;
  removeEnv: (envId: string) => Promise<void>;

  setFooterTab: (tab: FooterTab) => void;
  setWebCanGoBack: (canGoBack: boolean) => void;
  goHome: () => void;
  openTerminalDir: (dir: string) => void;
  closeTerminal: () => void;
  setFolderPickerOpen: (open: boolean) => void;
  quietEngineIfIdle: () => Promise<void>;
  resetWorkspace: () => Promise<string>;
}

const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export const useAppStore = create<AppState>((set, get) => ({
  envs: [DEFAULT_ENV],
  activeEnvId: 'default',
  footerTab: 'home',
  hydrated: false,
  enginePort: DEFAULT_ENGINE_PORT,
  themeMode: 'system',
  terminalDir: null,
  folderPickerOpen: false,
  webCanGoBack: false,

  hydrate: async () => {
    const { envs, activeEnvId } = await loadEnvs();
    const enginePort = (await AsyncStorage.getItem(ENGINE_PORT_KEY)) ?? DEFAULT_ENGINE_PORT;
    const storedTheme = await AsyncStorage.getItem(THEME_MODE_KEY);
    const themeMode: ThemeMode =
      storedTheme === 'light' || storedTheme === 'dark' ? storedTheme : 'system';
    set({ envs, activeEnvId, enginePort, themeMode, hydrated: true });
  },

  setEnginePort: async (enginePort) => {
    const port = enginePort.trim() || DEFAULT_ENGINE_PORT;
    set({ enginePort: port });
    await AsyncStorage.setItem(ENGINE_PORT_KEY, port);
  },

  setThemeMode: async (themeMode) => {
    set({ themeMode });
    try {
      await AsyncStorage.setItem(THEME_MODE_KEY, themeMode);
    } catch {
      // The in-memory choice still applies; persistence is best-effort.
    }
  },

  setActiveEnv: async (envId) => {
    set({ activeEnvId: envId });
    await saveEnvs(get().envs, envId);
  },

  addEnv: async (name, directory) => {
    const env: Env = { id: newId(), name: name.trim() || 'env', directory: directory.trim() };
    const envs = [...get().envs, env];
    set({ envs, activeEnvId: env.id });
    await saveEnvs(envs, env.id);
  },

  removeEnv: async (envId) => {
    if (envId === 'default') return;
    const envs = get().envs.filter((e) => e.id !== envId);
    const activeEnvId = get().activeEnvId === envId ? 'default' : get().activeEnvId;
    set({ envs, activeEnvId });
    await saveEnvs(envs, activeEnvId);
  },

  setFooterTab: (footerTab) => {
    set({ footerTab });
  },

  setWebCanGoBack: (webCanGoBack) => {
    set({ webCanGoBack });
  },

  goHome: () => {
    set({ footerTab: 'home' });
  },

  openTerminalDir: (dir) => {
    set({ terminalDir: dir, folderPickerOpen: false });
  },

  closeTerminal: () => set({ terminalDir: null }),

  setFolderPickerOpen: (folderPickerOpen) => set({ folderPickerOpen }),

  quietEngineIfIdle: async () => {
    await stopEngineIfIdle(get().enginePort);
  },

  resetWorkspace: async () => {
    // Full fresh start in one go: envs back to default, the engine's
    // database (sessions + server projects — the project list has no delete
    // API, so this is the only way to clear stale rows) wiped, serve
    // restarted. Auth password lives in prefs (not the DB) so it survives.
    // Working directories are left alone (user data, never deleted here).
    if (!isRunnerAvailable()) {
      const envs = [DEFAULT_ENV];
      set({ envs, activeEnvId: 'default' });
      await saveEnvs(envs, 'default');
      return 'envs reset (native module unavailable, engine untouched)';
    }
    const port = get().enginePort;
    try {
      stopServeService();
    } catch {
      // already down
    }
    await new Promise((r) => setTimeout(r, 2500));
    let removed = 0;
    try {
      const { Directory } = await import('expo-file-system');
      const dir = new Directory(`file://${getPrefix()}/phonecando-home/.local/share/opencode`);
      for (const entry of dir.list()) {
        const name = entry.name ?? '';
        if (
          name.startsWith('opencode-') &&
          (name.endsWith('.db') || name.endsWith('.db-shm') || name.endsWith('.db-wal'))
        ) {
          try {
            entry.delete();
            removed++;
          } catch {
            // locked or gone — restart will surface it
          }
        }
      }
    } catch (e) {
      return `reset failed: ${e instanceof Error ? e.message : String(e)}`;
    }
    const envs = [DEFAULT_ENV];
    set({ envs, activeEnvId: 'default' });
    await saveEnvs(envs, 'default');
    try {
      startServeService({ port });
    } catch (e) {
      return `workspace cleared, engine db wiped (${removed} files), but restart failed: ${e instanceof Error ? e.message : String(e)}`;
    }
    const up = await waitForEngine(port, 15000);
    return up
      ? `fresh start ready (engine db wiped, ${removed} files removed)`
      : 'workspace cleared and db wiped, but serve did not answer — check status';
  },
}));
