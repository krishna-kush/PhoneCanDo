// An agent's ACP turn as the app reads it (native.ts, parse.ts): the
// agent's text, its thinking, its tool steps and its plan, a permission
// question with its options, and how the turn ended. The runner keeps one
// turn per agent in ACP mode (engine/acp/ in the runner module).
import type { AgentId } from '../agents/records';

/** One thing the agent showed in its turn; the same id again is that item, grown or updated. */
export type AcpItem =
  /** Its answer so far (one message). */
  | { type: 'text'; id: string; text: string }
  /** Its thinking so far. */
  | { type: 'thought'; id: string; text: string }
  /** A tool step: its title, its kind (read, edit, execute…) and status (pending, in_progress, completed, failed). */
  | { type: 'tool'; id: string; title: string; kind: string | null; status: string | null }
  /** Its plan, one line per entry. */
  | { type: 'plan'; id: string; entries: string[] };

/** One answer the agent offers (`kind`: allow_once, allow_always, reject_once, reject_always). */
export type AcpOption = { optionId: string; name: string; kind: string };

/** The agent asks before a tool step. */
export type AcpPermission = {
  requestId: string;
  /** The step, as the agent titles it. */
  title: string;
  toolKind: string | null;
  options: AcpOption[];
};

/** How a turn ended: the agent's stop reason (end_turn, cancelled, refusal…) or an error. */
export type AcpTurnEnd = { stopReason: string | null; error: string | null };

/** The agent's turn as it is now. */
export type AcpSnapshot = {
  chatId: string | null;
  busy: boolean;
  items: AcpItem[];
  permission: AcpPermission | null;
};

/** One change to an agent's turn (the phonecandoAcp event). */
export type AcpEvent =
  | { agentId: AgentId; type: 'item'; item: AcpItem }
  | { agentId: AgentId; type: 'busy'; busy: boolean }
  | { agentId: AgentId; type: 'permission'; permission: AcpPermission }
  | { agentId: AgentId; type: 'permissionGone'; requestId: string }
  | { agentId: AgentId; type: 'turnEnd'; end: AcpTurnEnd };
