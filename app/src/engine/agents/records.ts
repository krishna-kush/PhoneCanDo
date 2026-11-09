// Agent instances and their engines (contract for several agents at once).
// An agent is one running instance of a kind with its own name, image, port,
// password and bridge token. Port, password and token stay native: the
// runner makes every request to an engine, and the TUI's start recipe
// carries the password through JS to the PTY without JS keeping it.
import type { ImageId } from '../linux/types';
import type { AgentKindId } from './registry';

export type AgentId = string;

export type Agent = {
  id: AgentId;
  kind: AgentKindId;
  name: string;
  /** The image this agent is attached to; created and deleted with it. */
  imageId: ImageId;
  createdAt: number;
  /** The version its last install or update recorded; null before one finished. */
  installedVersion: string | null;
  /** Its kind has an install and none finished yet: its engine refuses to start (agent_not_installed). */
  needsInstall: boolean;
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
  | 'too_many_running'
  | 'image_not_ready'
  | 'engine_missing'
  | 'port_unavailable'
  | 'start_failed'
  /** Its kind has an install and none finished yet (installAgent). */
  | 'agent_not_installed';
