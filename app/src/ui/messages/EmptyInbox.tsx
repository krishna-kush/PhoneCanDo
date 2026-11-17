import { YStack } from 'tamagui';
import { PLAIN, type Look } from '../../../../mascot/look.ts';
import type { AgentId } from '../../engine/agents/records';
import BoopFace from '../common/face/BoopFace';
import { useAgentLook } from '../common/face/useAgentLook';
import { useNap } from '../common/face/useNap';
import PlainText from '../common/PlainText';
import KeyHead from '../common/rows/KeyHead';
import { ROW_GUTTER } from '../common/rows/place';
import { usePageActive } from '../nav/pageActive';
import { EMPTY_TITLE, napLine } from './logic/messagesCopy';

type Props = {
  text: string;
  /** The agent the page is for: its own face dozes there. Null: every agent's page, A-01's. */
  agent: { id: AgentId; name: string } | null;
};

// The page with nothing to list: one key box with a face dozing by the
// inbox (A-01, or the agent the page is for, in its own mascot) and the
// plain line. A tap wakes it with a hop for a moment, then it nods off
// again (useNap).
export default function EmptyInbox({ text, agent }: Props) {
  if (!agent) return <Box text={text} who="A-01" mascot={PLAIN} />;
  return <AgentBox text={text} agentId={agent.id} name={agent.name} />;
}

function AgentBox({ text, agentId, name }: { text: string; agentId: AgentId; name: string }) {
  const { mascot } = useAgentLook(agentId);
  return <Box text={text} who={name} mascot={mascot} />;
}

function Box({ text, who, mascot }: { text: string; who: string; mascot: Look }) {
  const active = usePageActive();
  const nap = useNap();

  return (
    <YStack overflow="hidden" borderWidth={1} borderColor="line" backgroundColor="panel">
      <KeyHead title={EMPTY_TITLE} barcode="emptyInbox" />
      <YStack alignItems="center" gap="3" paddingHorizontal={ROW_GUTTER} paddingTop="5" paddingBottom="4">
        <BoopFace
          mood={nap.mood}
          mascot={mascot}
          size={40}
          still={!active}
          label={`${who}, asleep by the inbox. Tap it.`}
          onBoop={nap.boop}
          hitSlop={16}
        />
        <PlainText fontSize={14} color="muted" textAlign="center">
          {text}
        </PlainText>
        <PlainText fontFamily="mono" fontSize={10} letterSpacing={1.4} textTransform="uppercase" color="faint" textAlign="center">
          {napLine(nap.up, who)}
        </PlainText>
      </YStack>
    </YStack>
  );
}
