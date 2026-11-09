// Agents and their engines (contract: agents/records.ts). Several engines
// run at once, one per agent, in the runner's foreground service: at most
// three, the least recently used idle one stopped to make room. Each engine
// has its own port and password, which stay native: pairing the web UI, the
// TUI's start recipe and the idle check are made there from the kind's
// manifest. Reads answer empty where the native module is absent; changes
// throw.
import type { PtyRecipe } from '../../../agents/kit/ts/contract/pty.ts';
import type { Agent, AgentId, EngineStartError, EngineStatus } from './agents/records';
import type { AgentKindId } from './agents/registry';
import type { ImageId } from './linux/types';
import { getPrefix, isRunnerAvailable, nativeRunner, onRunnerEvent } from './runner';

export function listAgents(): Agent[] {
  if (!isRunnerAvailable()) return [];
  return nativeRunner().listAgents() as Agent[];
}

export function agentById(id: AgentId): Agent | null {
  return listAgents().find((a) => a.id === id) ?? null;
}

/** A new agent attached to an existing image; native mints its password and bridge token. */
export function createAgent(input: { kind: AgentKindId; name: string; imageId: ImageId }): Agent {
  return nativeRunner().createAgent(input) as Agent;
}

export function renameAgent(id: AgentId, name: string): Agent {
  return nativeRunner().renameAgent(id, name) as Agent;
}

/** Stops the agent's engine, then forgets the agent. The image is the Linux module's to delete. */
export function deleteAgent(id: AgentId): Promise<boolean> {
  return nativeRunner().deleteAgent(id);
}

/** The agent's HOME: its image's home/ (config, database, projects). */
export function agentHome(agent: Agent): string {
  return `${getPrefix()}/images/${agent.imageId}/home`;
}

/** A refused start, with the typed reason. */
export class EngineStartFailure extends Error {
  constructor(
    readonly code: EngineStartError,
    message: string,
  ) {
    super(message);
    this.name = 'EngineStartFailure';
  }
}

const START_ERRORS: EngineStartError[] = [
  'too_many_running',
  'image_not_ready',
  'engine_missing',
  'port_unavailable',
  'start_failed',
  'agent_not_installed',
];

/** Any start rejection as an EngineStartFailure (native puts the code first in the message). */
export function asStartFailure(e: unknown): EngineStartFailure {
  if (e instanceof EngineStartFailure) return e;
  const message = e instanceof Error ? e.message : String(e);
  const raw = (e as { code?: unknown } | null)?.code;
  const code =
    START_ERRORS.find((c) => c === raw) ?? START_ERRORS.find((c) => message.includes(`${c}:`)) ?? 'start_failed';
  return new EngineStartFailure(code, message);
}

/**
 * Starts the agent's engine, or finds it running. Resolves once the process
 * runs and its port is known (it may still be booting: waitForEngine).
 * Rejects with an EngineStartFailure.
 */
export async function startEngine(agentId: AgentId): Promise<{ port: string | null }> {
  try {
    return await nativeRunner().startEngine(agentId);
  } catch (e) {
    throw asStartFailure(e);
  }
}

export function stopEngine(agentId: AgentId): Promise<void> {
  return nativeRunner().stopEngine(agentId);
}

/** Resolves once no engine and no process an engine started is left. */
export function stopAllEngines(): Promise<void> {
  return nativeRunner().stopAllEngines();
}

/** Any engine, or any process an engine started, still alive. */
export function isAnyEngineAlive(): boolean {
  if (!isRunnerAvailable()) return false;
  return nativeRunner().isAnyEngineAlive();
}

/** The user is working with this agent: its engine is not the one stopped to make room. */
export function touchEngine(agentId: AgentId): void {
  if (!isRunnerAvailable()) return;
  nativeRunner().touchEngine(agentId);
}

/** The user has this agent's chat in front: its alert (or return notice) goes. */
export function dismissAgentAlert(agentId: AgentId): void {
  if (!isRunnerAvailable()) return;
  nativeRunner().dismissAgentAlert(agentId);
}

/** The chat on screen, by id or by title (nulls: none); the service notification leaves it out. */
export function setOpenChat(agentId: AgentId | null, sessionId: string | null, title: string | null = null): void {
  if (!isRunnerAvailable()) return;
  nativeRunner().setOpenChat(agentId, sessionId, title);
}

export function engineStatus(agentId: AgentId): EngineStatus {
  if (!isRunnerAvailable()) return { agentId, state: 'stopped', port: null, error: null, lastUsedAt: null };
  return nativeRunner().engineStatus(agentId);
}

/** Every agent's engine, in agent order. */
export function engineStatuses(): EngineStatus[] {
  if (!isRunnerAvailable()) return [];
  return nativeRunner().engineStatuses();
}

/** Every engine change (start, ready, died, stopped, failed). */
export function onEngineState(listener: (status: EngineStatus) => void): { remove(): void } {
  return onRunnerEvent<EngineStatus>('phonecandoEngineState', listener);
}

/** A fresh one-time URL that signs a WebView in to the agent's web UI. Rejects when the engine is down. */
export function pairWebUi(agentId: AgentId): Promise<string> {
  return nativeRunner().pairWebUi(agentId);
}

/**
 * The kind's TUI attached to the agent's running engine, in `projectDir`
 * (null `sessionId`: the engine picks the chat by folder). It carries the
 * engine password in its env, so pass it straight to the PTY; never keep it.
 */
export function clientRecipe(agentId: AgentId, projectDir: string, sessionId: string | null = null): PtyRecipe {
  return nativeRunner().clientRecipe(agentId, projectDir, sessionId);
}

/** No activity on the agent's engine for its kind's quiet time (an engine with none since its start is idle). */
export function isEngineIdle(agentId: AgentId): boolean {
  return nativeRunner().isEngineIdle(agentId);
}

/** 'ok' | 'starting' | 'http-N' | 'error:…', one probe with the agent's password. Blocks briefly. */
export function engineHealth(agentId: AgentId): string {
  return nativeRunner().engineHealth(agentId);
}
