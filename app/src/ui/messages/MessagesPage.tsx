import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, type ListRenderItem } from 'react-native';
import { YStack } from 'tamagui';
import type { AgentId } from '../../engine/agents/records';
import type { AgentMessage } from '../../engine/messages/types';
import { useAgentsStore } from '../../state/agents';
import { useAppStore } from '../../state/app';
import { useMessagesStore, useUnread } from '../../state/messages';
import { useAgentLook } from '../common/face/useAgentLook';
import PageHeader from '../common/PageHeader';
import TextAction from '../drawer/select/TextAction';
import Note from '../env/parts/Note';
import { usePageActive } from '../nav/pageActive';
import { useSlidIn, useSlidInList } from '../nav/slidIn';
import { emptyText, MESSAGES_INTRO, unreadText } from './logic/messagesCopy';
import { messagesFor, replyRef } from './logic/messageView';
import LevelsCard from './LevelsCard';
import MessageCard from './MessageCard';
import ScreenQueueBar from './ScreenQueueBar';

/** How often the screen queue is re-read while the page is in front (a claim nobody waits on sends no message). */
const SCREEN_POLL_MS = 5000;
/** How often "12 min ago" moves on. */
const TICK_MS = 30_000;
/** How long a message jumped to from a reply stays marked. */
const FLASH_MS = 1600;
/** The cards drawn while the page slides in. */
const FIRST_CARDS = 6;

type Props = { agentId: AgentId | null };

// What the agents on this phone say to each other, newest first: every
// message, or (opened from an agent's page) those to or from that agent.
// Unfiltered, how far messages reach each agent (LevelsCard) heads it.
// At the top, while one agent drives the phone's screen or another waits
// for it, the screen queue in one line. The log is read once the page has
// slid in and kept current while it is open; while it is in front the
// screen queue is re-read every few seconds and the times move on.
export default function MessagesPage({ agentId }: Props) {
  const active = usePageActive();
  const slidIn = useSlidIn();
  const log = useMessagesStore((s) => s.log);
  const screen = useMessagesStore((s) => s.screen);
  const replaceTop = useAppStore((s) => s.replaceTop);
  const [ready, setReady] = useState(false);
  const now = useNow(active);
  const list = useRef<FlatList<AgentMessage>>(null);
  const [flash, setFlash] = useState<number | null>(null);
  const wasActive = useRef(false);

  useEffect(() => {
    if (!slidIn) return;
    const stop = useMessagesStore.getState().watchMessages();
    setReady(true);
    return stop;
  }, [slidIn]);

  // Back in front after another page: re-read (the first time, the watch just did).
  useEffect(() => {
    if (!active) return;
    const { refreshMessages, refreshScreen } = useMessagesStore.getState();
    if (wasActive.current) refreshMessages();
    wasActive.current = true;
    const id = setInterval(refreshScreen, SCREEN_POLL_MS);
    return () => clearInterval(id);
  }, [active]);

  // Every message in front: what is there counts as seen (Home's chip goes).
  const latestId = useMessagesStore((s) => s.latestId);
  useEffect(() => {
    if (active && agentId == null) useMessagesStore.getState().markSeen();
  }, [active, agentId, latestId]);

  useEffect(() => {
    if (flash == null) return;
    const id = setTimeout(() => setFlash(null), FLASH_MS);
    return () => clearTimeout(id);
  }, [flash]);

  const shown = useMemo(() => messagesFor(log, agentId), [log, agentId]);
  const replies = useMemo(() => {
    const ids = new Set(shown.map((m) => m.id));
    return new Map(shown.map((m) => [m.id, replyRef(m, log, ids)]));
  }, [shown, log]);
  const data = useSlidInList(shown, FIRST_CARDS);
  const extra = useMemo(() => ({ flash, now, replies }), [flash, now, replies]);

  const jumpTo = useCallback(
    (id: number) => {
      const index = data.findIndex((m) => m.id === id);
      if (index < 0) return;
      list.current?.scrollToIndex({ index, viewPosition: 0.2, animated: true });
      setFlash(id);
    },
    [data],
  );

  const renderItem: ListRenderItem<AgentMessage> = ({ item }) => (
    <MessageCard
      message={item}
      reply={replies.get(item.id) ?? null}
      onReply={jumpTo}
      flash={item.id === flash}
      now={now}
    />
  );

  return (
    <YStack flex={1} backgroundColor="bg">
      <FlatList
        ref={list}
        data={data}
        keyExtractor={(m) => String(m.id)}
        renderItem={renderItem}
        extraData={extra}
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        ItemSeparatorComponent={Gap}
        initialNumToRender={FIRST_CARDS}
        ListHeaderComponent={
          <YStack gap="3" paddingBottom="3">
            <Head agentId={agentId} onAll={() => replaceTop({ name: 'messages' })} />
            <Note>{MESSAGES_INTRO}</Note>
            {agentId ? null : <LevelsCard />}
            <ScreenQueueBar queue={screen} />
          </YStack>
        }
        ListEmptyComponent={ready ? <EmptyLine agentId={agentId} /> : undefined}
        onScrollToIndexFailed={(info) => {
          // A card not laid out yet: get near it by the average height, then try again.
          list.current?.scrollToOffset({ offset: info.averageItemLength * info.index, animated: true });
          setTimeout(() => list.current?.scrollToIndex({ index: info.index, viewPosition: 0.2, animated: true }), 120);
        }}
      />
    </YStack>
  );
}

function Gap() {
  return <YStack height={8} />;
}

// The page's head: the agent it is filtered to (its serial, name and unread
// count) with All to see every message, or every agent's.
function Head({ agentId, onAll }: { agentId: AgentId | null; onAll: () => void }) {
  if (!agentId) return <PageHeader kicker="All agents" title="Messages" />;
  return <AgentHead agentId={agentId} onAll={onAll} />;
}

function AgentHead({ agentId, onAll }: { agentId: AgentId; onAll: () => void }) {
  const name = useAgentsStore((s) => s.agents.find((a) => a.id === agentId)?.name ?? null);
  const { serial } = useAgentLook(agentId);
  const unread = unreadText(useUnread(agentId));
  const kicker = [serial, name, unread].filter(Boolean).join(' · ');
  return <PageHeader kicker={kicker} title="Messages" trailing={<TextAction label="All" onPress={onAll} />} />;
}

function EmptyLine({ agentId }: { agentId: AgentId | null }) {
  const name = useAgentsStore((s) => (agentId ? (s.agents.find((a) => a.id === agentId)?.name ?? null) : null));
  return <Note>{emptyText(agentId ? (name ?? 'this agent') : null)}</Note>;
}

/** Now, moved on every half minute while `on`. */
function useNow(on: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!on) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, [on]);
  return now;
}
