import { useEffect } from 'react';
import type { Agent } from '../../engine/agents/records';
import { agentKind } from '../../engine/agents/registry';
import { canSetWakeable, messagesAvailable } from '../../engine/messages/native';
import { useAppStore } from '../../state/app';
import { useKindLevel } from '../../state/checks';
import { useMessagesStore, useUnread } from '../../state/messages';
import LinkRow from '../common/LinkRow';
import RowGroup from '../common/rows/RowGroup';
import { usePageActive } from '../nav/pageActive';
import { agentLevelLine, wakeBlockedLine } from './logic/levels';
import { unreadText } from './logic/messagesCopy';
import WakeRow from './WakeRow';

// The agent page's Messages group: Messages (the page filtered to it, with
// its unread count) with a line in it saying how far messages reach it
// (its kind's level now: delivered and can be woken, delivered, inbox
// only, can't read; lowered by what we saw not working), then "Other
// agents can wake it" for a kind that can be woken while idle: the kind's
// own level is wakes, by its `inbox.wake` (canWake) or by its ACP mode, as
// the runner's kindCanWake has it. While its level now is lower, a line
// in the switch row says what we saw fail; the switch stays, since the
// runner still tries a wake. Nothing on a build without messages.
// The counts are re-read each time the page comes to front.
export default function AgentMessageRows({ agent }: { agent: Agent }) {
  const push = useAppStore((s) => s.push);
  const unread = useUnread(agent.id);
  const active = usePageActive();
  const level = useKindLevel(agent.kind);
  useEffect(() => {
    if (active) useMessagesStore.getState().refreshMessages();
  }, [active]);
  if (!messagesAvailable()) return null;
  const kind = agentKind(agent.kind);
  const blocked = wakeBlockedLine(kind, level);
  return (
    <RowGroup title="Messages" barcode="agentMessages">
      <LinkRow
        label="Messages"
        detail={unreadText(unread) || undefined}
        note={agentLevelLine(level, kind.label)}
        noteAlert={level === 'none'}
        onPress={() => push({ name: 'messages', agentId: agent.id })}
      />
      {kind.messaging === 'wakes' && canSetWakeable() ? <WakeRow agent={agent} blocked={blocked} /> : null}
    </RowGroup>
  );
}
