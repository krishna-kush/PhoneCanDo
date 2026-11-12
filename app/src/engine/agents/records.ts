// Agent instances and their engines (contract for several agents at once).
// An agent is one running instance of a kind with its own name, port,
// password and bridge token, in a machine (image) other agents may share.
// Port, password and token stay native: the runner makes every request to
// an engine, and the TUI's start recipe carries the password through JS to
// the PTY without JS keeping it.
import type { ImageId } from '../linux/types';
import type { AgentKindId } from './registry';

export type AgentId = string;

export type Agent = {
  id: AgentId;
  kind: AgentKindId;
  name: string;
  /** Its machine: made with the first agent on it, other agents may share it, deleted with the last. */
  imageId: ImageId;
  /** Its work folder, projects/ in its HOME (host path): where its engine and terminals start. */
  projectDir: string;
  createdAt: number;
  /** The version its last install or update recorded; null before one finished. */
  installedVersion: string | null;
  /** Its kind has an install and none finished yet: its engine refuses to start (agent_not_installed). */
  needsInstall: boolean;
  /** The local model it runs on (engine/models/); null: the agent's own setup. */
  model: string | null;
  /** It has a sign-in and chats folder of its own, because another agent of its kind shares its
      machine; the runner removes that folder with the agent. */
  ownState: boolean;
};

export type EngineState = 'stopped' | 'starting' | 'ready' | 'stopping' | 'died' | 'failed';

export type EngineStatus = {
  agentId: AgentId;
  state: EngineState;
  /** The loopback port while starting or ready. */
  port: string | null;
  /** Why the last start failed or the engine died. */
  error: string | null;
  /** Last request or event, for "stop the least recently used idle engine". */
  lastUsedAt: number | null;
};

/** Typed reasons a start is refused. */
export type EngineStartError =
  /** The user's cap on agents at once is reached and none has been idle long enough to stop for room. */
  | 'too_many_running'
  | 'image_not_ready'
  | 'engine_missing'
  | 'port_unavailable'
  | 'start_failed'
  /** Its kind has an install and none finished yet (installAgent). */
  | 'agent_not_installed'
  /** Its local model cannot serve it; the message says why (gone, too big, ...). */
  | 'model_unavailable'
  /** Its local model is not loaded and the user's cap on models at once is reached. */
  | 'too_many_models';
