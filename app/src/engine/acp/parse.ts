// What native sends about an ACP turn, in the shapes the app reads
// (types.ts). Every field is checked: an older or newer runner may leave
// one out, and a bad record must not take Home down (it is dropped, or the
// field takes its default). Pure (zero RN imports):
// scripts/vectors/test_acp.js checks it.
import type { AcpEvent, AcpItem, AcpOption, AcpPermission, AcpSnapshot, AcpTurnEnd } from './types';

type Raw = Record<string, unknown> | null;

const str = (v: unknown): string | null => (typeof v === 'string' ? v : null);
const obj = (v: unknown): Raw => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null);
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

/** One item, or null without an id or a known type. */
export function asItem(value: unknown): AcpItem | null {
  const raw = obj(value);
  const id = str(raw?.id);
  if (!raw || !id) return null;
  switch (raw.type) {
    case 'text':
      return { type: 'text', id, text: str(raw.text) ?? '' };
    case 'thought':
      return { type: 'thought', id, text: str(raw.text) ?? '' };
    case 'tool':
      return { type: 'tool', id, title: str(raw.title) ?? '', kind: str(raw.kind) || null, status: str(raw.status) || null };
    case 'plan':
      return { type: 'plan', id, entries: list(raw.entries).filter((e): e is string => typeof e === 'string') };
    default:
      return null;
  }
}

/** One option, or null without an id. */
export function asOption(value: unknown): AcpOption | null {
  const raw = obj(value);
  const optionId = str(raw?.optionId);
  if (!optionId) return null;
  return { optionId, name: str(raw?.name) || optionId, kind: str(raw?.kind) ?? '' };
}

/** The options a permission question offers, bad ones dropped. */
export function asOptions(value: unknown): AcpOption[] {
  return list(value)
    .map(asOption)
    .filter((o): o is AcpOption => o != null);
}

/** A permission question, or null without a request id or any option to answer it with. */
export function asPermission(value: unknown): AcpPermission | null {
  const raw = obj(value);
  const requestId = str(raw?.requestId);
  const options = asOptions(raw?.options);
  if (!requestId || options.length === 0) return null;
  return { requestId, title: str(raw?.title) ?? '', toolKind: str(raw?.toolKind) || null, options };
}

/** An agent's turn as acpSnapshot returns it; null when it runs in terminal mode or not at all. */
export function asSnapshot(value: unknown): AcpSnapshot | null {
  const raw = obj(value);
  if (!raw) return null;
  return {
    chatId: str(raw.chatId) || null,
    busy: raw.busy === true,
    items: list(raw.items)
      .map(asItem)
      .filter((i): i is AcpItem => i != null),
    permission: asPermission(raw.permission),
  };
}

function asTurnEnd(raw: Raw): AcpTurnEnd {
  return { stopReason: str(raw?.stopReason) || null, error: str(raw?.error) || null };
}

/** One phonecandoAcp event, or null when it is not one we know. */
export function asAcpEvent(value: unknown): AcpEvent | null {
  const raw = obj(value);
  const agentId = str(raw?.agentId);
  if (!raw || !agentId) return null;
  switch (raw.type) {
    case 'item': {
      const item = asItem(raw.item);
      return item ? { agentId, type: 'item', item } : null;
    }
    case 'busy':
      return { agentId, type: 'busy', busy: raw.busy === true };
    case 'permission': {
      const permission = asPermission(raw.permission);
      return permission ? { agentId, type: 'permission', permission } : null;
    }
    case 'permissionGone': {
      const requestId = str(raw.requestId);
      return requestId ? { agentId, type: 'permissionGone', requestId } : null;
    }
    case 'turnEnd':
      return { agentId, type: 'turnEnd', end: asTurnEnd(raw) };
    default:
      return null;
  }
}
