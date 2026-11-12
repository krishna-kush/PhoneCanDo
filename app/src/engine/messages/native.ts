// Engine seam for agent-to-agent messages (types.ts): the runner's log,
// each agent's unread count, the screen queue and an agent's "Other agents
// can wake it", through the phonecando-runner module (engine/runner.ts).
// The app only reads the messages; agents send them. Native sends
// phonecandoMessages, with every agent's unread count, on each change to
// the log, a status or a count. A
// native build from before messaging reads as empty and cannot save the
// switch.
import type { Agent, AgentId } from '../agents/records';
import { isRunnerAvailable, nativeRunner, onRunnerEvent, type RunnerModule } from '../runner';
import { asMessageLog, asScreenQueue, asUnreadCounts, eventUnread, NO_SCREEN_QUEUE } from './parse';
import type { AgentMessage, ScreenQueue, UnreadCounts } from './types';

/** The runner keeps at most this many messages. */
export const LOG_LIMIT = 500;

function runner(): Partial<RunnerModule> {
  if (!isRunnerAvailable()) return {};
  try {
    return nativeRunner();
  } catch {
    return {};
  }
}

/** Whether this build keeps agent messages at all (the runner has the log). */
export function messagesAvailable(): boolean {
  return typeof runner().messageLog === 'function';
}

/** The newest `limit` messages, newest first; empty where the module or the method is absent. */
export function messageLog(limit: number = LOG_LIMIT): AgentMessage[] {
  try {
    return asMessageLog(runner().messageLog?.(limit));
  } catch {
    return [];
  }
}

/** Each agent's messages not read yet; empty where the module or the method is absent. */
export function unreadCounts(): UnreadCounts {
  try {
    return asUnreadCounts(runner().unreadCounts?.());
  } catch {
    return {};
  }
}

/** Who holds the screen and who waits; nobody where the module or the method is absent. */
export function screenQueue(): ScreenQueue {
  try {
    return asScreenQueue(runner().screenQueue?.());
  } catch {
    return NO_SCREEN_QUEUE;
  }
}

/** Whether this build can keep "Other agents can wake it". */
export function canSetWakeable(): boolean {
  return typeof runner().setAgentWakeable === 'function';
}

/** Saves "Other agents can wake it" and returns the agent as kept; null when this build cannot keep it. Throws as native does. */
export function setAgentWakeable(agentId: AgentId, wakeable: boolean): Agent | null {
  const m = runner();
  return typeof m.setAgentWakeable === 'function' ? (m.setAgentWakeable(agentId, wakeable) as Agent) : null;
}

/** Whether other agents may wake it: on unless switched off (a runner from before the switch sends none). */
export function isWakeable(agent: Pick<Agent, 'wakeable'>): boolean {
  return agent.wakeable !== false;
}

/**
 * Every change to the log, a status or the unread counts, with the counts
 * as they are now (null when the event carries none); a no-op subscription
 * where the module is absent.
 */
export function onMessages(listener: (unread: UnreadCounts | null) => void): { remove(): void } {
  return onRunnerEvent<unknown>('phonecandoMessages', (e) => listener(eventUnread(e)));
}
