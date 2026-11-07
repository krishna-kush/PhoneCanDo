// Every agent kind the app can run. Adding a kind is a folder next to oc/
// plus one line here. Screens look up the kind of the agent in question
// (`agentKind(agent.kind)`); there is no app-wide kind.
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
