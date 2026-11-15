// An agent's background run as Home shows it: the turn's items folded from
// the runner's snapshot and its events (an item that comes again by id is
// that item grown or updated), the permission question waiting, and how
// the turn ended; then the rows the view draws, newest last and capped.
// Pure (zero RN imports): scripts/vectors/test_acp.js checks it.
import type { AcpEvent, AcpItem, AcpPermission, AcpSnapshot, AcpTurnEnd } from '../../../../engine/acp/types';

export type BackgroundRun = {
  items: AcpItem[];
  permission: AcpPermission | null;
  /** How the last turn ended; null while one runs or before any ended. */
  end: AcpTurnEnd | null;
};

/** The runner keeps at most this many items of a turn; so do we. */
export const MAX_ITEMS = 200;
/** Rows the view draws: the newest. */
export const MAX_ROWS = 60;
/** Characters of one text the view draws: its end. */
export const MAX_TEXT = 4000;

export const EMPTY_RUN: BackgroundRun = { items: [], permission: null, end: null };

export function runOf(snapshot: AcpSnapshot | null): BackgroundRun {
  if (!snapshot) return EMPTY_RUN;
  return { items: snapshot.items.slice(-MAX_ITEMS), permission: snapshot.permission, end: null };
}

/**
 * The item as it is now. A text or plan comes whole each time; a tool step's
 * update may leave its title or kind out, which then stay. An item whose
 * type changed is the new one.
 */
export function mergeItem(old: AcpItem, next: AcpItem): AcpItem {
  if (old.type !== 'tool' || next.type !== 'tool') return next;
  return {
    type: 'tool',
    id: next.id,
    title: next.title || old.title,
    kind: next.kind ?? old.kind,
    status: next.status ?? old.status,
  };
}

/** The items with this one merged in place (by id), or added at the end; the oldest go past `max`. */
export function withItem(items: readonly AcpItem[], item: AcpItem, max: number = MAX_ITEMS): AcpItem[] {
  const at = items.findIndex((i) => i.id === item.id);
  if (at >= 0) {
    const next = items.slice();
    next[at] = mergeItem(items[at], item);
    return next;
  }
  const next = [...items, item];
  return next.length > max ? next.slice(next.length - max) : next;
}

/** The run after one of its events (events of other agents are the caller's to drop). */
export function foldEvent(run: BackgroundRun, e: AcpEvent): BackgroundRun {
  switch (e.type) {
    case 'item':
      return { ...run, items: withItem(run.items, e.item) };
    case 'permission':
      return { ...run, permission: e.permission };
    case 'permissionGone':
      return run.permission?.requestId === e.requestId ? { ...run, permission: null } : run;
    case 'turnEnd':
      return { ...run, permission: null, end: e.end };
    case 'busy':
      // A new turn has no end yet.
      return e.busy && run.end ? { ...run, end: null } : run;
  }
}

/** The end of a long text, marked as cut. */
export function tailText(text: string, max: number = MAX_TEXT): string {
  return text.length > max ? `…${text.slice(text.length - max)}` : text;
}

/** What the view draws: the newest items with something to show, long texts cut to their end. */
export function rowsOf(items: readonly AcpItem[], max: number = MAX_ROWS): AcpItem[] {
  const shown = items.filter((i) => {
    if (i.type === 'text' || i.type === 'thought') return i.text.trim() !== '';
    if (i.type === 'plan') return i.entries.length > 0;
    return true;
  });
  return shown.slice(-max).map((i) => (i.type === 'text' || i.type === 'thought' ? { ...i, text: tailText(i.text.trim()) } : i));
}
