// What the app shows: the footer tab, the folder picker and the terminal
// above the tabs. A terminal is bound to one agent when it opens: the terminal
// UI attaches to that agent's engine, the Linux terminal is a shell in its
// image. Switching the active agent later never moves an open terminal.
import type { StateCreator } from 'zustand';
import type { AgentId } from '../../engine/agents/records';
import type { AppState } from '../app';
import { useAgentsStore } from '../agents';

export type FooterTab = 'home' | 'env' | 'settings';

export type TerminalSession =
  /** The agent kind's terminal UI attached to a folder in the agent's HOME. */
  | { id: number; kind: 'tui'; agentId: AgentId; dir: string }
  /** A shell in the agent's Linux image; `initialInput` is typed in without Enter. */
  | { id: number; kind: 'linux'; agentId: AgentId; initialInput?: string };

export type NavigationSlice = {
  footerTab: FooterTab;
  /** The open terminal; null = closed. A new `id` per open remounts it. */
  terminal: TerminalSession | null;
  /** Folder picker overlay (terminal UI entry point, rooted at the active agent). */
  folderPickerOpen: boolean;
  /** Web view can go back to the web UI's home/project list. */
  webCanGoBack: boolean;

  setFooterTab: (tab: FooterTab) => void;
  setWebCanGoBack: (canGoBack: boolean) => void;
  goHome: () => void;
  /** The active agent's terminal UI in `dir`. */
  openTerminalDir: (dir: string) => void;
  openLinuxTerminal: (agentId: AgentId, initialInput?: string) => void;
  closeTerminal: () => void;
  setFolderPickerOpen: (open: boolean) => void;
};

let nextTerminalId = 1;

export const createNavigationSlice: StateCreator<AppState, [], [], NavigationSlice> = (set) => ({
  footerTab: 'home',
  terminal: null,
  folderPickerOpen: false,
  webCanGoBack: false,

  setFooterTab: (footerTab) => set({ footerTab }),

  setWebCanGoBack: (webCanGoBack) => set({ webCanGoBack }),

  goHome: () => set({ footerTab: 'home' }),

  openTerminalDir: (dir) => {
    const agentId = useAgentsStore.getState().activeAgentId;
    if (!agentId) return;
    set({ terminal: { id: nextTerminalId++, kind: 'tui', agentId, dir }, folderPickerOpen: false });
  },

  openLinuxTerminal: (agentId, initialInput) => {
    set({
      terminal: { id: nextTerminalId++, kind: 'linux', agentId, initialInput },
      folderPickerOpen: false,
    });
  },

  closeTerminal: () => set({ terminal: null }),

  setFolderPickerOpen: (folderPickerOpen) => set({ folderPickerOpen }),
});
