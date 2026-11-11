// Every page the app shows above Home, with what each one needs. Pure (zero
// RN imports): the page stack (stack.ts) and the vectors read it. Home
// itself is no route: it is always there, under the stack.
import type { AgentId } from '../../engine/agents/records';
import type { EnvId } from '../../engine/linux/types';
import type { AgentPick } from '../flows/logic/modelStep';

/** A tag the user picked, with what the picker knew about it. */
export type PickedTag = { name: string; sizeArm64: number | null; lastUpdated: string | number | null };

/** What a new agent's machine is made from: where it runs. */
export type NewAgentTarget =
  /** An env that is already there (New agent here, or a system picked in the place step). */
  | { kind: 'env'; envId: EnvId }
  /** The baked Default env, made once. */
  | { kind: 'default' }
  /** No Linux in this build: Android's own shell. */
  | { kind: 'android' }
  /** An Own env: the download starts once the agent is picked. */
  | { kind: 'own'; repo: string; tag: PickedTag; typed: boolean };

export type TerminalSession =
  /** The agent kind's terminal UI attached to a folder in the agent's HOME. */
  | { id: number; kind: 'tui'; agentId: AgentId; dir: string }
  /** A shell in the agent's Linux image; `initialInput` is typed in without Enter. */
  | { id: number; kind: 'linux'; agentId: AgentId; initialInput?: string };

export type Route =
  /** One agent: its engine, the ways in and its settings rows; `fresh` right after it was made. */
  | { name: 'agent'; agentId: AgentId; fresh?: boolean }
  /** The agent's local model. */
  | { name: 'agent-model'; agentId: AgentId }
  /** The agent's machine: its env, OS, size and missing tools. */
  | { name: 'agent-machine'; agentId: AgentId }
  /** The agent's install inside its machine (a kind with one). */
  | { name: 'agent-install'; agentId: AgentId }
  /**
   * New agent, step 1: which kind, and its model. With `target` the place is
   * set already (New agent here, Android only) and this step makes it;
   * `picked` starts picked (a custom agent just added from here).
   */
  | { name: 'new-agent'; target?: NewAgentTarget; picked?: string }
  /** New agent, step 2: where the picked agent runs. */
  | { name: 'new-agent-place'; pick: AgentPick }
  /**
   * Own env: which OS (official list or any name). `pick` is the agent New
   * agent picked; without one (Add system) the agent is picked after the
   * last look, as its first agent comes with the download.
   */
  | { name: 'new-env-os'; pick?: AgentPick }
  /** Own env: which version of `repo`. */
  | { name: 'new-env-tags'; repo: string; pick?: AgentPick }
  /** Own env: last look before the download; `typed` when the tag came with the typed name. */
  | { name: 'new-env-confirm'; repo: string; tag: PickedTag; typed: boolean; pick?: AgentPick }
  /** Own env: the download running. */
  | { name: 'new-env-pull'; repo: string; tag: string; envId: EnvId }
  /** Every env (system), each with how many agents run on it. */
  | { name: 'systems' }
  /** One system: what it is, its download, the agents on it, Delete; envId null for machines we can't place. */
  | { name: 'system'; envId: EnvId | null }
  /** Add system: Default (when it was deleted) or download a Linux; either comes with its first agent. */
  | { name: 'add-system' }
  /** Custom agents: the user's own kinds, to add, edit, share or delete. */
  | { name: 'custom-agents' }
  /** A custom agent's form: a new one (kindId null) or an edit; `forNewAgent` when opened from New agent. */
  | { name: 'custom-agent'; kindId: string | null; forNewAgent?: boolean }
  /** A custom agent pasted in. */
  | { name: 'custom-agent-import' }
  /** Local models: suggestions, Hugging Face search, downloads, the models on the phone. */
  | { name: 'models' }
  /** One Hugging Face repository's models. */
  | { name: 'model-repo'; repo: string }
  | { name: 'settings' }
  | { name: 'about' }
  /** Which folder the active agent's terminal UI opens in. */
  | { name: 'folder-picker' }
  | { name: 'terminal'; session: TerminalSession };

export type RouteName = Route['name'];
