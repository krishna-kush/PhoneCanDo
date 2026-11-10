// The Env tab's pages and where Back goes from each. Pure (zero RN imports).
// The route lives in a store (nav.ts), not in component state, so the agent
// page is still there after the TUI or a terminal opened on top and closed.
import type { AgentId } from '../../../engine/agents/records';
import type { EnvId } from '../../../engine/linux/types';

/** A tag the user picked, with what the picker knew about it. */
export type PickedTag = { name: string; sizeArm64: number | null; lastUpdated: string | number | null };

/** What a new agent's machine is made from: the Choose agent step's subject. */
export type NewAgentTarget =
  /** New agent here: an env that is already there. */
  | { kind: 'env'; envId: EnvId }
  /** New env → Default: the baked env, made once. */
  | { kind: 'default' }
  /** No Linux in this build: Android's own shell. */
  | { kind: 'android' }
  /** New env → Own: the download starts once the agent is picked. */
  | { kind: 'own'; repo: string; tag: PickedTag; typed: boolean };

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
  | { name: 'new-env-pull'; repo: string; tag: string; envId: EnvId }
  /** Choose agent: which kind the new agent is (only when there is a choice); `picked` starts picked. */
  | { name: 'new-agent'; target: NewAgentTarget; picked?: string }
  /** Custom agents: the user's own kinds, to add, edit, share or delete. */
  | { name: 'custom-agents' }
  /** A custom agent's form: a new one (kindId null) or an edit; from Choose agent when `target` is set. */
  | { name: 'custom-agent'; kindId: string | null; target: NewAgentTarget | null }
  /** A custom agent pasted in. */
  | { name: 'custom-agent-import' }
  /** Local models: suggestions, Hugging Face search, downloads, the models on the phone; from an agent's page when `agentId` is set. */
  | { name: 'models'; agentId?: AgentId }
  /** One Hugging Face repository's models. */
  | { name: 'model-repo'; repo: string; agentId?: AgentId };

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
    case 'new-agent':
      return parentOfTarget(route.target);
    case 'custom-agents':
      return { name: 'list' };
    case 'custom-agent':
      return route.target ? { name: 'new-agent', target: route.target } : { name: 'custom-agents' };
    case 'custom-agent-import':
      return { name: 'custom-agents' };
    case 'models':
      return route.agentId ? { name: 'agent', agentId: route.agentId } : { name: 'list' };
    case 'model-repo':
      return { name: 'models', agentId: route.agentId };
  }
}

function parentOfTarget(target: NewAgentTarget): EnvRoute {
  switch (target.kind) {
    case 'default':
      return { name: 'new-env' };
    case 'own':
      return { name: 'new-env-confirm', repo: target.repo, tag: target.tag, typed: target.typed };
    case 'env':
    case 'android':
      return { name: 'list' };
  }
}
