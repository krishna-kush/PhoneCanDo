// The first shift's walks: Lead the way leads to a mission's place a
// tap at a time, from Home, pointing at each thing to tap (a spot,
// common/spot/). Which step shows is read from where the app is now (Home,
// the drawer, the page on top) and which spots are on screen, never from
// counting taps, so Back, a wrong turn or a page still sliding in can't put
// it out of step. Pure (zero RN imports).
import type { Route } from '../../../../state/app/routes.ts';
import type { MissionId } from '../../../../state/logic/starter/missions.ts';
import type { SpotId } from '../../../common/spot/ids.ts';

/** Where the app is: 'home', 'drawer', or the top page's route name ('settings-page:updates' for one of Settings' pages). */
export type Place = string;

export function placeOf(pages: readonly { route: Route }[], drawerOpen: boolean): Place {
  if (drawerOpen) return 'drawer';
  const top = pages[pages.length - 1]?.route;
  if (!top) return 'home';
  return top.name === 'settings-page' ? `settings-page:${top.page}` : top.name;
}

/** What Home shows for the active agent: its web UI, or a terminal (its TUI). */
export type HomeView = 'web' | 'tui';

/** Which words a step says (walk/copy.ts). */
export type StepId =
  | 'chat'
  | 'projects'
  | 'addProject'
  | 'pickFolder'
  | 'newChat'
  | 'name'
  | 'menu'
  | 'menuAgent'
  | 'terminal'
  | 'settings'
  | 'phone'
  | 'updates'
  | 'newAgent'
  | 'pick'
  | 'place'
  | 'machine'
  | 'schedules'
  | 'add'
  | 'save';

export type Step = {
  id: StepId;
  /** Its number on the way; two steps share one when they are the same hop two ways (an empty list's big Add). */
  hop: number;
  /** The places it shows in. */
  at: readonly Place[];
  /** What it points at; null: its words alone. */
  spot: SpotId | null;
  /** Point at the spot's foot only (the chat box, at the bottom of the chat). */
  foot?: boolean;
  /** The spot sits in a menu that floats over the app: the guide rises above it. */
  floats?: boolean;
};

export type Walk = {
  steps: readonly Step[];
  /** Places where the walk has arrived (its page is open): the stamp's turn. */
  goal: readonly Place[];
};

const NAME: Step = { id: 'name', hop: 1, at: ['home'], spot: 'home.name' };
const SETTINGS: Step = { id: 'settings', hop: 2, at: ['drawer'], spot: 'drawer.settings' };

// Say hi: to the chat box. A terminal's is at its foot. A web UI may want
// a project and a chat in it first (its spots, from the kind's manifest):
// the furthest one on screen shows, so an agent with a chat open goes
// straight to its box.
const HELLO: Record<HomeView, Walk> = {
  tui: { steps: [{ id: 'chat', hop: 1, at: ['home'], spot: 'home.chat', foot: true }], goal: [] },
  web: {
    steps: [
      { id: 'projects', hop: 1, at: ['home'], spot: 'web.projects' },
      { id: 'addProject', hop: 2, at: ['home'], spot: 'web.addProject' },
      { id: 'pickFolder', hop: 3, at: ['home'], spot: 'web.pickFolder' },
      { id: 'newChat', hop: 4, at: ['home'], spot: 'web.newChat' },
      { id: 'chat', hop: 5, at: ['home'], spot: 'web.composer' },
    ],
    goal: [],
  },
};

const WALKS: Record<Exclude<MissionId, 'hello'>, Walk> = {
  terminal: {
    steps: [
      { id: 'menu', hop: 1, at: ['home'], spot: 'home.menu' },
      { id: 'menuAgent', hop: 2, at: ['home'], spot: 'menu.agent', floats: true },
      { id: 'terminal', hop: 3, at: ['agent'], spot: 'agent.terminal' },
    ],
    goal: ['terminal'],
  },
  hands: { steps: [NAME, SETTINGS, { id: 'phone', hop: 3, at: ['settings'], spot: 'settings.phone' }], goal: [] },
  upgrade: {
    steps: [NAME, SETTINGS, { id: 'updates', hop: 3, at: ['settings'], spot: 'settings.updates' }],
    goal: ['settings-page:updates'],
  },
  teammate: {
    steps: [
      NAME,
      { id: 'newAgent', hop: 2, at: ['drawer'], spot: 'drawer.newAgent' },
      { id: 'pick', hop: 3, at: ['new-agent', 'custom-agent', 'custom-agent-import'], spot: 'newAgent.next' },
      { id: 'place', hop: 4, at: ['new-agent-place'], spot: 'newAgent.place' },
      // A Linux of its own to download, in place of a ready one.
      { id: 'machine', hop: 4, at: ['new-env-os', 'new-env-tags', 'new-env-confirm', 'new-env-pull'], spot: null },
    ],
    goal: [],
  },
  schedule: {
    steps: [
      NAME,
      { id: 'schedules', hop: 2, at: ['drawer'], spot: 'drawer.schedules' },
      { id: 'add', hop: 3, at: ['schedules'], spot: 'schedules.add' },
      { id: 'add', hop: 3, at: ['schedules'], spot: 'schedules.addFirst' },
      { id: 'save', hop: 4, at: ['schedules'], spot: 'schedules.save' },
    ],
    goal: [],
  },
};

/** [mission]'s walk, with Home showing the active agent as [home]. */
export const walkFor = (mission: MissionId, home: HomeView): Walk =>
  mission === 'hello' ? HELLO[home] : WALKS[mission];

/** How many hops the walk takes. */
export const hopsOf = (walk: Walk): number => walk.steps.reduce((n, s) => Math.max(n, s.hop), 0);

export type WalkAt =
  /** Arrived: its page is open. */
  | { kind: 'goal' }
  /** The first shift's own page: the guide steps aside. */
  | { kind: 'aside' }
  /** Somewhere the walk doesn't pass. */
  | { kind: 'lost' }
  /** A step to show; `ready` once its spot is on screen to point at (always, for words alone). */
  | { kind: 'step'; step: Step; hops: number; ready: boolean };

/**
 * Where [walk] is, at [place] with the spots [shown]: of the steps here,
 * the furthest whose spot is on screen (Home's ⋮ menu, open, is further
 * than the ⋮ itself), else the first here, waiting for its spot.
 */
export function walkAt(walk: Walk, place: Place, shown: (spot: SpotId) => boolean): WalkAt {
  if (walk.goal.includes(place)) return { kind: 'goal' };
  if (place === 'starter') return { kind: 'aside' };
  const here = walk.steps.filter((s) => s.at.includes(place));
  if (here.length === 0) return { kind: 'lost' };
  const hops = hopsOf(walk);
  for (let i = here.length - 1; i >= 0; i--) {
    const step = here[i];
    if (step.spot == null || shown(step.spot)) return { kind: 'step', step, hops, ready: true };
  }
  return { kind: 'step', step: here[0], hops, ready: false };
}

/**
 * Whether going from [from] to [to] is a step back: a lower hop, a wrong
 * turn, or the same step's spot gone. On the way, a screen often passes
 * through one for a moment (a menu closing before a dialog opens, the
 * drawer shutting before a page comes), so the guide shows one only once
 * it has lasted.
 */
export function stepsBack(from: WalkAt | null, to: WalkAt | null): boolean {
  if (from?.kind !== 'step' || to == null) return false;
  if (to.kind === 'lost') return true;
  if (to.kind !== 'step') return false;
  if (to.step.hop !== from.step.hop) return to.step.hop < from.step.hop;
  return to.step.spot === from.step.spot && from.ready && !to.ready;
}
