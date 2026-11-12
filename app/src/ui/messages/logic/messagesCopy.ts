// What the messages parts say: a message's time, the screen queue's line,
// the unread counts, the agent page's rows and the page's empty and intro
// lines. Plain and short; the agents are AI agents, never "you". Pure
// (zero RN imports).
import type { ScreenQueue } from '../../../engine/messages/types';
import { nameList } from '../../memory/logic/memoryCopy.ts';

const MIN = 60_000;
const HOUR = 60 * MIN;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function hhmm(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function startOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** "just now", "12 min ago", "14:32", "yesterday 09:05", "3 Nov 18:40", "3 Nov 2025" (the phone's own time zone). */
export function messageTime(sentAt: number, now: number): string {
  if (!(sentAt > 0)) return '';
  const ago = now - sentAt;
  if (ago < MIN) return 'just now';
  if (ago < HOUR) return `${Math.floor(ago / MIN)} min ago`;
  const at = new Date(sentAt);
  const today = startOfDay(now);
  if (sentAt >= today) return hhmm(at);
  if (sentAt >= startOfDay(today - 1)) return `yesterday ${hhmm(at)}`;
  const day = `${at.getDate()} ${MONTHS[at.getMonth()]}`;
  return at.getFullYear() === new Date(now).getFullYear() ? `${day} ${hhmm(at)}` : `${day} ${at.getFullYear()}`;
}

/**
 * The screen queue in one line, or null when nobody has the screen or
 * waits for it: "Builder holds the screen · Reviewer waiting". A holder
 * handed the screen that has not started driving it yet has its turn
 * ("Reviewer's turn at the screen"); with no holder at all, the first in
 * line gets it next.
 */
export function screenLine(queue: ScreenQueue): string | null {
  const waiting = queue.waiting.map((w) => w.name);
  if (queue.holder) {
    const held = queue.reserved ? `${queue.holder.name}'s turn at the screen` : `${queue.holder.name} holds the screen`;
    return waiting.length > 0 ? `${held} · ${nameList(waiting)} waiting` : held;
  }
  if (waiting.length === 0) return null;
  const [next, ...rest] = waiting;
  const turn = `${next} gets the screen next`;
  return rest.length > 0 ? `${turn} · ${nameList(rest)} waiting` : turn;
}

/** Home's chip: "1 new msg", "3 new msgs" (two digits at most). */
export function newMessagesChip(n: number): string {
  const count = n > 99 ? '99+' : String(n);
  return n === 1 ? '1 new msg' : `${count} new msgs`;
}

/** For a screen reader, on Home's chip. */
export function newMessagesLabel(n: number): string {
  return `${n === 1 ? '1 new message' : `${n} new messages`} between agents. Opens Messages.`;
}

/** "1 unread", "4 unread"; empty for none. */
export function unreadText(n: number): string {
  return n > 0 ? `${n} unread` : '';
}

/** A small mark's number: at most two digits. */
export function unreadMark(n: number): string {
  return n > 99 ? '99+' : String(n);
}

/** For a screen reader, after an agent's name. */
export function unreadLabel(n: number): string {
  if (n <= 0) return '';
  return n === 1 ? '1 unread message' : `${n} unread messages`;
}

export const WAKE_TITLE = 'Other agents can wake it';

/** Under the switch: what it does, on or off. */
export function wakeSubtitle(on: boolean): string {
  return on
    ? "A message that asks to wake it can start a turn while it's idle. A stopped agent stays stopped."
    : 'Messages wait for its next turn.';
}

/** Above the list: what these are. */
export const MESSAGES_INTRO =
  'What the agents on this phone say to each other. Each agent is told a message comes from another AI agent, not from you.';

/** With nothing to list. */
export function emptyText(agentName: string | null): string {
  return agentName
    ? `No messages to or from ${agentName} yet.`
    : 'No messages yet. When agents talk to each other, it shows here.';
}
