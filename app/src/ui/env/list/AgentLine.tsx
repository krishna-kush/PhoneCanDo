import type { ReactNode } from 'react';
import { XStack, YStack } from 'tamagui';
import type { Agent } from '../../../engine/agents/records';
import { useAgentsStore } from '../../../state/agents';
import ChevronIcon from '../../common/ChevronIcon';
import AgentFace from '../../common/face/AgentFace';
import { useAgentLook } from '../../common/face/useAgentLook';
import PlainText from '../../common/PlainText';
import { usePageActive } from '../../nav/pageActive';
import { activityWord } from '../logic/engineState';

type Props = {
  agent: Agent;
  /** Its machine's record is gone. */
  missing: boolean;
  /** Its machine's size, on the machine's only agent; null on a shared machine (its line has it). */
  size: string | null;
  /** Null: the line is the page's own agent, shown but not opened. */
  onOpen: ((agentId: string) => void) | null;
  /** Before its engine's word (its kind's name, on a machine's page). */
  label?: string;
  /** A running engine's activity (Working or Idle instead of Running); null or absent: not known. */
  idle?: boolean | null;
  /** After its engine's word (its unread messages, on a machine's page); empty or absent: nothing. */
  extra?: string;
  /** Under its line, inside the tap (its machine's setup state). */
  children?: ReactNode;
};

// One agent in a list, as its machine's row or one of a shared machine's
// agents (Systems, an agent's Machine page): its face, name and engine's
// word. A tap opens its page.
export default function AgentLine({ agent, missing, size, onOpen, label, idle = null, extra, children }: Props) {
  const status = useAgentsStore((s) => s.statuses[agent.id]);
  const state = missing ? 'Its machine is missing' : activityWord(status?.state, idle);
  const sub = [label, state, extra, size, onOpen ? null : 'this agent'].filter(Boolean).join(' · ');
  return (
    <YStack
      paddingHorizontal="3"
      paddingVertical="2"
      gap="2"
      backgroundColor={onOpen ? 'press:panel2' : undefined}
      onPress={onOpen ? () => onOpen(agent.id) : undefined}
      accessibilityRole={onOpen ? 'button' : undefined}
      accessibilityLabel={`${agent.name}, ${sub}`}
    >
      <LineBody
        lead={<RowFace agentId={agent.id} />}
        title={agent.name}
        sub={sub}
        trailing={
          onOpen ? (
            <YStack flexShrink={0} paddingRight="1" opacity={0.5}>
              <ChevronIcon size={18} />
            </YStack>
          ) : null
        }
      />
      {children}
    </YStack>
  );
}

/** A list line's face or plate, title, the line under it and what trails it. */
export function LineBody({ lead, title, sub, trailing }: { lead: ReactNode; title: string; sub: string; trailing: ReactNode }) {
  return (
    <XStack alignItems="center" gap="3" minHeight={40}>
      {lead}
      <YStack flex={1} minWidth={0} gap={2}>
        <PlainText fontSize={16} fontWeight="600" numberOfLines={1} ellipsizeMode="tail">
          {title}
        </PlainText>
        <PlainText fontFamily="mono" fontSize={12} color="dim" numberOfLines={1}>
          {sub}
        </PlainText>
      </YStack>
      {trailing}
    </XStack>
  );
}

// Still while another page covers this one.
function RowFace({ agentId }: { agentId: string }) {
  const look = useAgentLook(agentId);
  const active = usePageActive();
  return <AgentFace mood={look.mood} pose={look.pose} size={18} still={!active} />;
}
