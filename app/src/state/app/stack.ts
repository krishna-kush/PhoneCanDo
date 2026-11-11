// The page stack above Home: how pages open, close and hand over. Pure (zero
// RN imports, every function returns a new array); the navigation slice
// applies it and scripts/vectors/test_nav_stack.js checks it. Each page has
// a key of its own, so the same route opened twice is two pages and a page
// keeps its state while others open above it.
import type { AgentId } from '../../engine/agents/records';
import type { Route, TerminalSession } from './routes';

export type Page = { key: number; route: Route };

export function pushPage(pages: readonly Page[], page: Page): Page[] {
  return [...pages, page];
}

/** One page down; Home (an empty stack) stays as it is. */
export function popPage(pages: readonly Page[]): Page[] {
  return pages.slice(0, -1);
}

export function replaceTop(pages: readonly Page[], page: Page): Page[] {
  return [...pages.slice(0, -1), page];
}

/** The stack cut at the first page that matches: it and everything above it go. */
export function cutAt(pages: readonly Page[], match: (route: Route) => boolean): Page[] {
  const i = pages.findIndex((p) => match(p.route));
  return i < 0 ? [...pages] : pages.slice(0, i);
}

const CREATION: ReadonlySet<Route['name']> = new Set([
  'add-system',
  'new-agent',
  'new-agent-place',
  'new-env-os',
  'new-env-tags',
  'new-env-confirm',
  'new-env-pull',
]);

/** A page of a New agent run (the custom agent form only when New agent opened it). */
export function isCreationRoute(route: Route): boolean {
  if (route.name === 'custom-agent') return route.forNewAgent === true;
  return CREATION.has(route.name);
}

/**
 * Where a New agent run lands (the new agent's page, the download's
 * progress, the systems list): its steps go, so Back from there returns to
 * where the run started.
 */
export function afterCreation(pages: readonly Page[], page: Page): Page[] {
  return [...cutAt(pages, isCreationRoute), page];
}

function routeAgent(route: Route): AgentId | null {
  if (route.name === 'terminal') return route.session.agentId;
  return 'agentId' in route ? (route.agentId ?? null) : null;
}

/** Every page of a deleted agent goes, with whatever opened above them. */
export function withoutAgent(pages: readonly Page[], agentId: AgentId): Page[] {
  return cutAt(pages, (r) => routeAgent(r) === agentId);
}

const isTerminalPage = (route: Route) => route.name === 'terminal' || route.name === 'folder-picker';

/** A terminal opens on top; one already open (and the folder picker) closes first: one at a time. */
export function withTerminal(pages: readonly Page[], page: Page): Page[] {
  return [...pages.filter((p) => !isTerminalPage(p.route)), page];
}

export function withoutTerminal(pages: readonly Page[]): Page[] {
  return pages.filter((p) => p.route.name !== 'terminal');
}

export function terminalOf(pages: readonly Page[]): TerminalSession | null {
  for (let i = pages.length - 1; i >= 0; i--) {
    const r = pages[i].route;
    if (r.name === 'terminal') return r.session;
  }
  return null;
}

/**
 * Home in front for a reason from outside (a notification, an agent coming
 * back): the pages go, but an open terminal stays where it is, on top, so
 * whatever runs in it lives on.
 */
export function towardHome(pages: readonly Page[]): Page[] {
  const i = pages.findIndex((p) => p.route.name === 'terminal');
  return i < 0 ? [] : [pages[i]];
}

/**
 * A custom agent saved from New agent: back to the nearest New agent step,
 * which reopens (`key`) with that kind picked. Unchanged without such a step.
 */
export function returnWithKind(pages: readonly Page[], kindId: string, key: number): Page[] {
  for (let i = pages.length - 1; i >= 0; i--) {
    const r = pages[i].route;
    if (r.name === 'new-agent') return [...pages.slice(0, i), { key, route: { ...r, picked: kindId } }];
  }
  return [...pages];
}
