// What the app shows: Home (the active agent's own UI) under a stack of
// pages (routes.ts, stack.ts), and the side drawer. A terminal is a page
// bound to one agent when it opens: the terminal UI attaches to that
// agent's engine, the Linux terminal is a shell in its image. Switching the
// active agent later never moves an open terminal.
import type { StateCreator } from 'zustand';
import type { AgentId } from '../../engine/agents/records';
import type { AppState } from '../app';
import { useAgentsStore } from '../agents';
import type { Route } from './routes';
import {
  afterCreation,
  popPage,
  pushPage,
  replaceTop,
  returnWithKind,
  terminalOf,
  towardHome,
  withoutAgent,
  withoutTerminal,
  withTerminal,
  type Page,
} from './stack';

export type NavigationSlice = {
  /** The pages above Home, bottom first; empty: Home is in front. */
  pages: Page[];
  /** The side drawer (agents, New agent, Models, Systems, Settings) over Home. */
  drawerOpen: boolean;

  push: (route: Route) => void;
  /** One page down; false on Home. */
  back: () => boolean;
  replaceTop: (route: Route) => void;
  /** Home in front: every page and the drawer close. */
  goHome: () => void;
  /** Home in front for a reason from outside; an open terminal stays on top (stack.ts towardHome). */
  showHome: () => void;
  /** A New agent run is over: its steps close and `route` opens in their place. */
  finishCreation: (route: Route) => void;
  /** An agent was deleted: its pages close. */
  leaveAgent: (agentId: AgentId) => void;
  /** A custom agent saved from New agent: back to its first step with the kind picked. */
  returnWithKind: (kindId: string) => void;
  setDrawerOpen: (open: boolean) => void;
  /** The folder picker for the active agent's terminal UI. */
  openFolderPicker: () => void;
  /** The active agent's terminal UI in `dir` (in place of the folder picker). */
  openTerminalDir: (dir: string) => void;
  openLinuxTerminal: (agentId: AgentId, initialInput?: string) => void;
  closeTerminal: () => void;
};

let nextKey = 1;
let nextTerminalId = 1;

const page = (route: Route): Page => ({ key: nextKey++, route });

/** The open terminal, if any. */
export const selectTerminal = (s: Pick<NavigationSlice, 'pages'>) => terminalOf(s.pages);

export const createNavigationSlice: StateCreator<AppState, [], [], NavigationSlice> = (set, get) => ({
  pages: [],
  drawerOpen: false,

  push: (route) => set((s) => ({ pages: pushPage(s.pages, page(route)), drawerOpen: false })),

  back: () => {
    if (get().pages.length === 0) return false;
    set((s) => ({ pages: popPage(s.pages) }));
    return true;
  },

  replaceTop: (route) => set((s) => ({ pages: replaceTop(s.pages, page(route)) })),

  goHome: () => set({ pages: [], drawerOpen: false }),

  showHome: () => set((s) => ({ pages: towardHome(s.pages), drawerOpen: false })),

  finishCreation: (route) => set((s) => ({ pages: afterCreation(s.pages, page(route)), drawerOpen: false })),

  leaveAgent: (agentId) => set((s) => ({ pages: withoutAgent(s.pages, agentId) })),

  returnWithKind: (kindId) => set((s) => ({ pages: returnWithKind(s.pages, kindId, nextKey++) })),

  setDrawerOpen: (drawerOpen) => set({ drawerOpen }),

  openFolderPicker: () => set((s) => ({ pages: pushPage(s.pages, page({ name: 'folder-picker' })), drawerOpen: false })),

  openTerminalDir: (dir) => {
    const agentId = useAgentsStore.getState().activeAgentId;
    if (!agentId) return;
    const session = { id: nextTerminalId++, kind: 'tui' as const, agentId, dir };
    set((s) => ({ pages: withTerminal(s.pages, page({ name: 'terminal', session })), drawerOpen: false }));
  },

  openLinuxTerminal: (agentId, initialInput) => {
    const session = { id: nextTerminalId++, kind: 'linux' as const, agentId, initialInput };
    set((s) => ({ pages: withTerminal(s.pages, page({ name: 'terminal', session })), drawerOpen: false }));
  },

  closeTerminal: () => set((s) => ({ pages: withoutTerminal(s.pages) })),
});
