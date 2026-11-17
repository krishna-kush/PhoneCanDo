// A recent run's row beyond its words (scheduleCopy.ts): the agent's reply
// as the row quotes it, and whether a tap opens the chat it ran in. Pure
// (zero RN imports).
import type { AgentId } from '../../../engine/agents/records';
import type { ScheduleRun } from '../../../engine/schedule/types';

/** The lines a row quotes. */
export const REPLY_LINES = 3;
/** Past this, the quote's text is cut (its row shows REPLY_LINES lines at most anyway). */
const REPLY_CHARS = 400;

/**
 * A reply's first lines, as its row quotes them: each trimmed, blank lines
 * and code fences left out, at most REPLY_LINES, cut at REPLY_CHARS with
 * an ellipsis. Null without a reply or words in it.
 */
export function replyExcerpt(reply: string | null): string | null {
  if (!reply) return null;
  const lines = reply
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !/^(```|~~~)/.test(line))
    .slice(0, REPLY_LINES);
  if (lines.length === 0) return null;
  const text = lines.join('\n');
  return text.length <= REPLY_CHARS ? text : `${text.slice(0, REPLY_CHARS - 1).trimEnd()}…`;
}

/** A run's row opens its chat while its agent is still here (with no chat kept, the agent's Home). */
export function runOpens(run: ScheduleRun, agents: readonly { id: AgentId }[]): boolean {
  return agents.some((a) => a.id === run.agentId);
}
