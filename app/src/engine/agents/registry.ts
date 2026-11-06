// Every agent kind the app can run. Adding a kind is a folder next to oc/
// plus one line here.
import { opencodeKind } from './oc/kind';
import type { AgentKind, AgentKindId } from './types';

const KINDS: Record<AgentKindId, AgentKind> = {
  opencode: opencodeKind,
};

/** The kind a fresh install starts with. */
export const DEFAULT_AGENT_KIND: AgentKindId = 'opencode';

export function agentKind(id: AgentKindId): AgentKind {
  return KINDS[id];
}

/** The kind of the engine the app talks to now (one engine, the default
    kind, until several agents exist). */
export function activeAgentKind(): AgentKind {
  return agentKind(DEFAULT_AGENT_KIND);
}
