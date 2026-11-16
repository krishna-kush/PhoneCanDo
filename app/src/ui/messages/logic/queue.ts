// The screen queue as the site's deli counter (FIG. 05B): one agent at the
// screen, the rest in line holding tickets, and the counter's "now
// serving". Pure (zero RN imports).
import type { AgentId } from '../../../engine/agents/records';
import type { ScreenQueue } from '../../../engine/messages/types';

const no = (n: number) => String(n).padStart(2, '0');

/** One agent at the counter: its ticket ("No. 02") and where it stands. */
export type Spot = { agentId: AgentId; name: string; ticket: string };

/** Who holds the screen (ticket 01) and who waits, in line order; tickets go on from the holder's. */
export function queueSpots(queue: ScreenQueue): { holder: Spot | null; line: Spot[] } {
  const holder = queue.holder ? { ...queue.holder, ticket: `No. ${no(1)}` } : null;
  const first = holder ? 2 : 1;
  return { holder, line: queue.waiting.map((w, i) => ({ ...w, ticket: `No. ${no(first + i)}` })) };
}

/** The strip's counter: the holder's ticket, or dashes while the screen is free. */
export function nowServing(queue: ScreenQueue): string {
  return `Now serving ${queue.holder ? no(1) : '––'}`;
}

/** Under the screen's spot: what its holder does, or that it is free. */
export function screenWord(queue: ScreenQueue): string {
  if (!queue.holder) return 'free';
  return queue.reserved ? 'its turn' : 'driving';
}

/** The strip's title. */
export const COUNTER_TITLE = 'The screen · one driver';

/** Over the line, and with nobody in it. */
export const IN_LINE = 'In line';
export const NOBODY_WAITING = 'Nobody waiting.';
