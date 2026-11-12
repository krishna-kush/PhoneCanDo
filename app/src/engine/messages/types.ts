// Agent-to-agent messages as the app reads them (contract: the runner's
// NativeMessage and NativeScreenQueue). Agents send each other messages
// through the runner's bridge tools (agents_send and friends); the runner
// keeps the log in app-private storage, delivers each message through the
// recipient kind's hooks, extension or server, and records per recipient
// whether it waits, was delivered, was read or was refused, and whether it
// woke the agent. It also posts notices of its own (the screen queue:
// someone waits for the screen, the screen is yours).
import type { AgentId } from '../agents/records';

/** Who sent a message: an agent (its name kept after it is deleted, agentId then null) or the runner itself. */
export type MessageFrom = { agentId: AgentId | null; name: string; kind: string | null };

/** Who it went to: one agent, everyone on the sender's machine (its image), or every agent on the phone. */
export type MessageTo =
  | { kind: 'agent'; agentId: AgentId | null; name: string }
  | { kind: 'machine'; imageId: string | null }
  | { kind: 'phone' };

/** Queued: not in its turn yet (waiting); delivered: put in its turn; read: its hook or inbox confirmed it; refused: never sent. */
export type DeliveryStatus = 'queued' | 'delivered' | 'read' | 'refused';

export type MessageDelivery = {
  agentId: AgentId;
  name: string;
  status: DeliveryStatus;
  /** The message started a turn of this agent (it was idle and wakeable). */
  woke: boolean;
  /** Why it was refused (the runner's words); null otherwise. */
  reason: string | null;
};

export type AgentMessage = {
  /** The runner's sequence: a larger id is a newer message. */
  id: number;
  from: MessageFrom;
  to: MessageTo;
  text: string;
  /** The message this one answers; null for none. */
  replyTo: number | null;
  sentAt: number;
  /** 0 for a turn the user started; one more for each agent message in the chain that led to it. */
  hop: number;
  /** A runner notice (the screen queue), not an agent's message. */
  notice: boolean;
  deliveries: MessageDelivery[];
};

export type ScreenAgent = { agentId: AgentId; name: string };

/**
 * Who has the phone's screen and who waits for it, first in line first.
 * `reserved`: the holder was handed the screen and has not started driving
 * it yet (it is kept for it a moment).
 */
export type ScreenQueue = { holder: ScreenAgent | null; reserved: boolean; waiting: ScreenAgent[] };

/** Each agent's messages not read yet; agents with none are left out. */
export type UnreadCounts = Record<AgentId, number>;
