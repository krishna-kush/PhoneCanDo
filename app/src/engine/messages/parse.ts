// What native sends, in the shapes the app reads (types.ts). Every field is
// checked: an older or newer runner may leave one out, and a bad record
// must not take a screen down (it is dropped, or the field takes its
// default). Pure (zero RN imports): scripts/vectors/test_messages.js
// checks it.
import type { MessagingLevel } from '../../../../agents/kit/ts/contract/view.ts';
import type {
  AgentMessage,
  DeliveryStatus,
  MessageDelivery,
  MessageTo,
  ScreenAgent,
  ScreenQueue,
  UnreadCounts,
} from './types';

type Raw = Record<string, unknown> | null;

/** A kind's messaging level as the runner sends it (KindView.messaging); anything else reads as none. */
export function levelOf(raw: unknown): MessagingLevel {
  return raw === 'wakes' || raw === 'delivered' || raw === 'inbox' || raw === 'none' ? raw : 'none';
}

export const NO_SCREEN_QUEUE: ScreenQueue = { holder: null, reserved: false, waiting: [] };

const STATUSES: readonly string[] = ['queued', 'delivered', 'read', 'refused'];

const str = (v: unknown): string | null => (typeof v === 'string' ? v : null);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const obj = (v: unknown): Raw => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null);
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

function asTo(raw: Raw): MessageTo {
  const kind = str(raw?.kind);
  if (kind === 'machine') return { kind, imageId: str(raw?.imageId) };
  if (kind === 'phone') return { kind };
  return { kind: 'agent', agentId: str(raw?.agentId), name: str(raw?.name) ?? '' };
}

function asDelivery(raw: Raw): MessageDelivery | null {
  const agentId = str(raw?.agentId);
  if (!agentId) return null;
  const status = str(raw?.status);
  return {
    agentId,
    name: str(raw?.name) || agentId,
    status: status && STATUSES.includes(status) ? (status as DeliveryStatus) : 'queued',
    woke: raw?.woke === true,
    reason: str(raw?.reason) || null,
  };
}

/** One message, or null without an id. */
export function asMessage(value: unknown): AgentMessage | null {
  const raw = obj(value);
  const id = num(raw?.id);
  if (id == null) return null;
  const from = obj(raw?.from);
  return {
    id,
    from: { agentId: str(from?.agentId), name: str(from?.name) ?? '', kind: str(from?.kind) },
    to: asTo(obj(raw?.to)),
    text: str(raw?.text) ?? '',
    replyTo: num(raw?.replyTo),
    sentAt: num(raw?.sentAt) ?? 0,
    hop: num(raw?.hop) ?? 0,
    notice: raw?.notice === true,
    deliveries: list(raw?.deliveries)
      .map((d) => asDelivery(obj(d)))
      .filter((d): d is MessageDelivery => d != null),
  };
}

/** The log, newest first as the runner sends it; records without an id dropped. */
export function asMessageLog(value: unknown): AgentMessage[] {
  return list(value)
    .map(asMessage)
    .filter((m): m is AgentMessage => m != null);
}

/** Counts above zero only. */
export function asUnreadCounts(value: unknown): UnreadCounts {
  const counts: UnreadCounts = {};
  for (const [id, n] of Object.entries(obj(value) ?? {})) {
    const count = num(n);
    if (count != null && count > 0) counts[id] = Math.floor(count);
  }
  return counts;
}

/** The unread counts a phonecandoMessages event carries (`{unread}`); null when it carries none. */
export function eventUnread(value: unknown): UnreadCounts | null {
  const raw = obj(value);
  return raw && obj(raw.unread) ? asUnreadCounts(raw.unread) : null;
}

function asScreenAgent(value: unknown): ScreenAgent | null {
  const raw = obj(value);
  const agentId = str(raw?.agentId);
  return agentId ? { agentId, name: str(raw?.name) || agentId } : null;
}

export function asScreenQueue(value: unknown): ScreenQueue {
  const raw = obj(value);
  if (!raw) return NO_SCREEN_QUEUE;
  const holder = asScreenAgent(raw.holder);
  return {
    holder,
    reserved: holder != null && raw.reserved === true,
    waiting: list(raw.waiting)
      .map(asScreenAgent)
      .filter((w): w is ScreenAgent => w != null),
  };
}
