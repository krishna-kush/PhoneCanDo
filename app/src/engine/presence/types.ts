// Presence as the app reads it (contract: the runner's PresenceFrame, sent
// as plain maps by presenceSnapshot and the phonecandoPresence event): who
// has the phone's controls (an agent driving, or a hand-over to you) and
// each agent's short "what I'm doing now" line (agents_status).
import type { AgentId } from '../agents/records';

/** watch: you drive, the agent still sees and keeps running. paused: you drive, the agent's run is stopped until Start me again. */
export type HandMode = 'watch' | 'paused';

/** Who started the hand-over: you (the mascot's Let me or Stop) or the agent (phone_hand_over). */
export type HandBy = 'user' | 'agent';

export type HandOver = {
  agentId: AgentId;
  agentName: string;
  mode: HandMode;
  by: HandBy;
  /** The agent's reason; null when you started it. */
  why: string | null;
};

export type StatusMood = 'working' | 'thinking' | 'waiting';

/** An agent's line, cleaned by the runner (one line, at most 80 characters). */
export type AgentStatus = { text: string; mood: StatusMood };

export type PresenceFrame = {
  /** The agent driving the phone now; null when nobody does. */
  driver: { agentId: AgentId; name: string } | null;
  handOver: HandOver | null;
  /** Agents with a line now; the rest are left out. */
  statuses: Record<AgentId, AgentStatus>;
};

/** What the hand-over's buttons ask (the runner's UserAct). */
export type UserAct = 'LET_ME' | 'STOP' | 'GIVE_BACK' | 'START_AGAIN' | 'LEAVE';
