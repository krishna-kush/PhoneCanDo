// The Env tab's pages and where Back goes from each. Pure (zero RN imports).
// The route lives in a store (nav.ts), not in component state, so the agent
// page is still there after the TUI or a terminal opened on top and closed.
import type { AgentId } from '../../../engine/agents/records';
import type { EnvId } from '../../../engine/linux/types';

/** A tag the user picked, with what the picker knew about it. */
export type PickedTag = { name: string; sizeArm64: number | null; lastUpdated: string | number | null };

export type EnvRoute =
  | { name: 'list' }
  | { name: 'agent'; agentId: AgentId }
  /** New env, step 1: Default or Own. */
  | { name: 'new-env' }
  /** Own: which OS (official list or any name). */
  | { name: 'new-env-os' }
  /** Own: which version of `repo`. */
  | { name: 'new-env-tags'; repo: string }
  /** Own: last look before the download; `typed` when the tag came with the typed name. */
  | { name: 'new-env-confirm'; repo: string; tag: PickedTag; typed: boolean }
  /** Own: the download running. */
  | { name: 'new-env-pull'; repo: string; tag: string; envId: EnvId };

/** Where Back goes; null on the list (the app's own Back takes over). */
export function parentRoute(route: EnvRoute): EnvRoute | null {
  switch (route.name) {
    case 'list':
      return null;
    case 'agent':
    case 'new-env':
    case 'new-env-pull': // the download keeps going; the list shows it
      return { name: 'list' };
    case 'new-env-os':
      return { name: 'new-env' };
    case 'new-env-tags':
      return { name: 'new-env-os' };
    case 'new-env-confirm':
      return route.typed ? { name: 'new-env-os' } : { name: 'new-env-tags', repo: route.repo };
  }
}
