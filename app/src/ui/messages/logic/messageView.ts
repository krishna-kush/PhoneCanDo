// What the Messages page lists and how each message reads: the messages to
// or from one agent, who sent it and to whom, each recipient's status (and
// whether the message woke it), and the message a reply answers. Pure (zero
// RN imports).
import type { AgentId } from '../../../engine/agents/records';
import type { AgentMessage, DeliveryStatus, MessageDelivery } from '../../../engine/messages/types';

/** The name a runner notice goes by. */
export const RUNNER_NAME = 'PhoneCanDo';

/** A palette role (theme/tokens.json) for a line's ink. */
export type Tone = 'fg' | 'muted' | 'dim' | 'primary' | 'secondaryInk';

/** The message is from the agent, to it, or reached it. */
export function involves(m: AgentMessage, agentId: AgentId): boolean {
  if (m.from.agentId === agentId) return true;
  if (m.to.kind === 'agent' && m.to.agentId === agentId) return true;
  return m.deliveries.some((d) => d.agentId === agentId);
}

/** The log as the page shows it: everything, or what involves one agent; newest first, as the runner sends it. */
export function messagesFor(log: readonly AgentMessage[], agentId: AgentId | null): AgentMessage[] {
  return agentId ? log.filter((m) => involves(m, agentId)) : [...log];
}

export function fromLabel(m: AgentMessage): string {
  if (m.notice) return RUNNER_NAME;
  return m.from.name || 'An agent';
}

/** An agent's name, or the sender's whole machine or the whole phone. */
export function toLabel(m: AgentMessage): string {
  if (m.to.kind === 'machine') return 'its machine';
  if (m.to.kind === 'phone') return 'whole phone';
  return m.to.name || m.deliveries[0]?.name || 'an agent';
}

/** "Builder → Reviewer", "Builder → whole phone". */
export function routeLine(m: AgentMessage): string {
  return `${fromLabel(m)} → ${toLabel(m)}`;
}

const STATUS_WORDS: Record<DeliveryStatus, string> = {
  queued: 'waiting',
  delivered: 'delivered',
  read: 'read',
  refused: 'refused',
};

const STATUS_TONES: Record<DeliveryStatus, Tone> = {
  queued: 'dim',
  delivered: 'muted',
  read: 'secondaryInk',
  refused: 'primary',
};

/** "waiting", "read", "refused: not wakeable". */
export function statusText(d: Pick<MessageDelivery, 'status' | 'reason'>): string {
  const word = STATUS_WORDS[d.status];
  return d.status === 'refused' && d.reason ? `${word}: ${d.reason}` : word;
}

export type DeliveryLine = { key: string; text: string; tone: Tone };

/**
 * Each recipient's status, one line each. A message to one agent names it
 * in its head already, so its line is only the status ("read · woke
 * Reviewer", "read · started Reviewer" when it was stopped); a message to
 * a machine or the phone names each recipient.
 */
export function deliveryLines(m: AgentMessage): DeliveryLine[] {
  const single = m.to.kind === 'agent' && m.deliveries.length === 1;
  return m.deliveries.map((d) => {
    const status = statusText(d);
    const text = single
      ? [status, wokeText(d, d.name)].filter(Boolean).join(' · ')
      : [d.name, status, wokeText(d, 'it')].filter(Boolean).join(' · ');
    return { key: d.agentId, text, tone: STATUS_TONES[d.status] };
  });
}

/** A recipient's rubber stamp: its status word, red when refused; none while it waits (a live light says it is on its way). */
export type DeliveryStamp = { word: string; tone: 'primary' | 'secondary' };

export function deliveryStamp(status: DeliveryStatus): DeliveryStamp | null {
  if (status === 'queued') return null;
  return { word: STATUS_WORDS[status], tone: status === 'refused' ? 'primary' : 'secondary' };
}

/** One recipient as the page marks it: its name (on a message to many), its stamp and a few words after it. */
export type DeliveryMark = { key: string; name: string | null; stamp: DeliveryStamp | null; note: string | null; tone: Tone };

/**
 * Each recipient's mark. A message to one agent names it in its head
 * already, so its mark has no name. After the stamp: why it was refused,
 * whether the message woke or started it, or, still waiting, "waiting".
 */
export function deliveryMarks(m: AgentMessage): DeliveryMark[] {
  const single = m.to.kind === 'agent' && m.deliveries.length === 1;
  return m.deliveries.map((d) => {
    const stamp = deliveryStamp(d.status);
    if (d.status === 'refused') return { key: d.agentId, name: single ? null : d.name, stamp, note: d.reason, tone: 'primary' };
    if (d.status === 'queued') return { key: d.agentId, name: single ? null : d.name, stamp, note: 'waiting', tone: 'dim' };
    return { key: d.agentId, name: single ? null : d.name, stamp, note: wokeText(d, single ? d.name : 'it'), tone: 'secondaryInk' };
  });
}

// "started Reviewer" when its engine was started for it, "woke Reviewer" when it only woke.
function wokeText(d: Pick<MessageDelivery, 'woke' | 'started'>, who: string): string | null {
  if (d.started) return `started ${who}`;
  return d.woke ? `woke ${who}` : null;
}

/** The first words of a message, on one line, cut at `max` characters with an ellipsis. */
export function snippet(text: string, max = 60): string {
  const line = text.replace(/\s+/g, ' ').trim();
  return line.length <= max ? line : `${line.slice(0, max - 1).trimEnd()}…`;
}

/** What a reply answers: the message when the log still has it (`shown`: it is in the list on screen). */
export type ReplyRef = { id: number; message: AgentMessage | null; shown: boolean };

export function replyRef(
  m: AgentMessage,
  log: readonly AgentMessage[],
  shown: ReadonlySet<number>,
): ReplyRef | null {
  if (m.replyTo == null) return null;
  const message = log.find((x) => x.id === m.replyTo) ?? null;
  return { id: m.replyTo, message, shown: shown.has(m.replyTo) };
}

/** "↩ Reviewer: “can you check the…”", or the id alone when the log has let it go. */
export function replyText(ref: ReplyRef): string {
  if (!ref.message) return `↩ answers an older message (#${ref.id})`;
  return `↩ ${fromLabel(ref.message)}: “${snippet(ref.message.text, 48)}”`;
}

/** All of the unread counts together. */
export function unreadTotal(unread: Readonly<Record<AgentId, number>>): number {
  return Object.values(unread).reduce((sum, n) => sum + (n > 0 ? n : 0), 0);
}
