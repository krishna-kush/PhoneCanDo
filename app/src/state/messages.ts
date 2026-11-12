// Agent messages as the screens read them (engine/messages/): each agent's
// unread count (the drawer's marks, an agent's Messages row), how many came
// since the user last looked (Home's chip) and, while a Messages page is
// open, the log and the screen queue. The first refresh
// subscribes to the runner's changes (each carries the unread counts, so
// those land at once) and to the app coming back to the foreground; a
// burst of changes (a broadcast to every agent) reads the log once.
// Re-read records that did not change stay the same objects, so a
// row that shows one skips the render.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import { create } from 'zustand';
import type { AgentId } from '../engine/agents/records';
import { messageLog, onMessages, screenQueue, unreadCounts } from '../engine/messages/native';
import { NO_SCREEN_QUEUE } from '../engine/messages/parse';
import type { AgentMessage, ScreenQueue, UnreadCounts } from '../engine/messages/types';
import { keepUnchangedMap, sameValue } from './logic/keepUnchanged';

/** A burst of runner changes within this reads once. */
const SETTLE_MS = 150;

/** The newest message id the user has seen on the Messages page. */
const SEEN_KEY = 'phonecando.messagesSeen.v1';

interface MessagesState {
  unread: UnreadCounts;
  /** Newest first; read only while a Messages page watches (empty before). */
  log: AgentMessage[];
  screen: ScreenQueue;
  /** Re-reads the unread counts, and the log and the screen queue while a page watches; subscribes once. */
  refreshMessages: () => void;
  /** A Messages page in front: reads the log and the queue now and on each change, until the returned stop. */
  watchMessages: () => () => void;
  /** Re-reads the screen queue alone (it can change with no message: a claim nobody waits on). */
  refreshScreen: () => void;
  /** The newest message's id (ids only grow); 0 for none. */
  latestId: number;
  /** The newest one the user has seen on the Messages page; null until read from storage. */
  seenId: number | null;
  /** The Messages page shows them all: what is there now counts as seen. */
  markSeen: () => void;
}

let subscribed = false;
let watchers = 0;
let pending: ReturnType<typeof setTimeout> | null = null;

/** The log with each unchanged message kept as the same object. */
function keepLog(prev: AgentMessage[], next: AgentMessage[]): AgentMessage[] {
  const old = new Map(prev.map((m) => [m.id, m]));
  const kept = next.map((m) => {
    const was = old.get(m.id);
    return was !== undefined && sameValue(was, m) ? was : m;
  });
  const same = kept.length === prev.length && kept.every((m, i) => m === prev[i]);
  return same ? prev : kept;
}

export const useMessagesStore = create<MessagesState>((set, get) => {
  const readScreen = () => {
    const screen = screenQueue();
    if (!sameValue(get().screen, screen)) set({ screen });
  };

  const setUnread = (next: UnreadCounts) => {
    const unread = keepUnchangedMap(get().unread, next);
    if (unread !== get().unread) set({ unread });
  };

  const readLatest = () => {
    const latestId = messageLog(1)[0]?.id ?? 0;
    if (latestId !== get().latestId) set({ latestId });
  };

  // What the user saw last, kept across launches; on a first run, what is
  // there already counts as seen (only messages from now on are new).
  const loadSeen = () => {
    AsyncStorage.getItem(SEEN_KEY)
      .then((raw) => {
        const stored = raw == null ? NaN : Number(raw);
        if (Number.isFinite(stored)) set({ seenId: stored });
        else get().markSeen();
      })
      .catch(() => get().markSeen());
  };

  const read = () => {
    setUnread(unreadCounts());
    readLatest();
    if (watchers === 0) return;
    const log = keepLog(get().log, messageLog());
    if (log !== get().log) set({ log });
    readScreen();
  };

  const soon = () => {
    if (pending) return;
    pending = setTimeout(() => {
      pending = null;
      read();
    }, SETTLE_MS);
  };

  const subscribe = () => {
    if (subscribed) return;
    subscribed = true;
    loadSeen();
    onMessages((unread) => {
      if (unread == null) return soon();
      setUnread(unread);
      readLatest();
      if (watchers > 0) soon();
    });
    AppState.addEventListener('change', (state) => {
      if (state === 'active') soon();
    });
  };

  return {
    unread: {},
    log: [],
    screen: NO_SCREEN_QUEUE,

    refreshMessages: () => {
      subscribe();
      read();
    },

    watchMessages: () => {
      subscribe();
      watchers++;
      read();
      let stopped = false;
      return () => {
        if (stopped) return;
        stopped = true;
        watchers--;
      };
    },

    refreshScreen: readScreen,

    latestId: 0,
    seenId: null,
    markSeen: () => {
      const seenId = get().latestId;
      if (seenId === get().seenId) return;
      set({ seenId });
      AsyncStorage.setItem(SEEN_KEY, String(seenId)).catch(() => {});
    },
  };
});

/** Messages since the user last looked at the Messages page (Home's chip); 0 until that is known. */
export function useNewMessages(): number {
  return useMessagesStore((s) => (s.seenId == null ? 0 : Math.max(0, s.latestId - s.seenId)));
}

/** The agent's unread messages; re-renders only when its own count changes. */
export function useUnread(agentId: AgentId): number {
  return useMessagesStore((s) => s.unread[agentId] ?? 0);
}
