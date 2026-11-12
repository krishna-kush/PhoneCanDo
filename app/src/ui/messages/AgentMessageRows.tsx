import { useEffect } from 'react';
import { YStack } from 'tamagui';
import type { Agent } from '../../engine/agents/records';
import { agentKind } from '../../engine/agents/registry';
import { canSetWakeable, messagesAvailable } from '../../engine/messages/native';
import { useAppStore } from '../../state/app';
import { useMessagesStore, useUnread } from '../../state/messages';
import LinkRow from '../common/LinkRow';
import PlainText from '../common/PlainText';
import { usePageActive } from '../nav/pageActive';
import { agentLevelLine } from './logic/levels';
import { unreadText } from './logic/messagesCopy';
import WakeRow from './WakeRow';

// The agent's messages in its Settings block: Messages (the page filtered
// to it, with its unread count), a line saying how far messages reach it
// (its kind's level: delivered and can be woken, delivered, inbox only,
// can't read), then "Other agents can wake it" for a kind that can be
// woken while idle. Nothing on a build without
// messages. The counts are re-read each time the page comes to front.
export default function AgentMessageRows({ agent }: { agent: Agent }) {
  const push = useAppStore((s) => s.push);
  const unread = useUnread(agent.id);
  const active = usePageActive();
  useEffect(() => {
    if (active) useMessagesStore.getState().refreshMessages();
  }, [active]);
  if (!messagesAvailable()) return null;
  const kind = agentKind(agent.kind);
  return (
    <>
      <LinkRow
        label="Messages"
        detail={unreadText(unread) || undefined}
        onPress={() => push({ name: 'messages', agentId: agent.id })}
      />
      <YStack paddingHorizontal="2" paddingBottom="2">
        <PlainText fontSize={13} color={kind.messaging === 'none' ? 'primary' : 'muted'}>
          {agentLevelLine(kind.messaging, kind.label)}
        </PlainText>
      </YStack>
      {kind.canWake && canSetWakeable() ? <WakeRow agent={agent} /> : null}
    </>
  );
}
