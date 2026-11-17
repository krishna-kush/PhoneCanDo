// The places on screen the app can point at, each a thing to tap: Home's
// bar, the drawer's rows, a page's button, a button in an agent's web UI.
// A component marks one with `<Spot>` or `useSpot` (registry.ts), the web
// view its page's (chat/useWebSpots.ts); a guide finds it by name. Pure
// (zero RN imports).
import type { WebSpot } from '../../../../../agents/kit/ts/contract/web.ts';

export type SpotId =
  /** Home's bar: the agent's name (opens the drawer), its ⋮ menu, and the chat under them (a terminal's). */
  | 'home.name'
  | 'home.menu'
  | 'home.chat'
  /** In Home's web UI, on the way to a chat (the kind's manifest says where). */
  | `web.${WebSpot}`
  /** Home's ⋮ menu, open: Agent settings. */
  | 'menu.agent'
  /** The drawer: New agent, Schedules, Settings. */
  | 'drawer.newAgent'
  | 'drawer.schedules'
  | 'drawer.settings'
  /** Settings: Phone control's Accessibility setup, the Updates row. */
  | 'settings.phone'
  | 'settings.updates'
  /** Schedules: Add in the head, the big Add on an empty list, the editor's save. */
  | 'schedules.add'
  | 'schedules.addFirst'
  | 'schedules.save'
  /** An agent's page: Open terminal. */
  | 'agent.terminal'
  /** New agent: Next under the agents, then the recommended place. */
  | 'newAgent.next'
  | 'newAgent.place';
