import { XStack, YStack } from 'tamagui';
import type { AgentId } from '../../../engine/agents/records';
import AgentFace from '../../common/face/AgentFace';
import { useAgentLook } from '../../common/face/useAgentLook';
import PlainText from '../../common/PlainText';
import LiveLight from '../../common/rows/LiveLight';
import type { Spot } from '../logic/queue';

type ScreenProps = {
  holder: Spot | null;
  /** What its holder does ("driving", "its turn") or "free". */
  word: string;
  /** Driving now: its light blinks. */
  live: boolean;
  still: boolean;
};

// The counter's screen: a phone, front on, with the holder's face on it
// (it hops as it steps up), its name and what it does; "free" on a blank
// screen while nobody holds it.
export function ScreenSpot({ holder, word, live, still }: ScreenProps) {
  return (
    <YStack alignItems="center" gap="1" width={76} flexShrink={0}>
      <YStack width={46} height={64} borderWidth={1.5} borderColor="lineStrong" backgroundColor="bg" alignItems="center" justifyContent="center">
        <YStack position="absolute" top={5} width={10} height={1.5} backgroundColor="lineStrong" />
        {holder ? (
          <Face key={holder.agentId} agentId={holder.agentId} size={24} hop still={still} />
        ) : (
          <PlainText fontFamily="mono" fontSize={9} letterSpacing={1.2} textTransform="uppercase" color="faint">
            free
          </PlainText>
        )}
      </YStack>
      {holder ? (
        <PlainText fontFamily="mono" fontSize={11} fontWeight="600" numberOfLines={1}>
          {holder.name}
        </PlainText>
      ) : null}
      <XStack alignItems="center" gap="1">
        {live ? <LiveLight still={still} /> : null}
        <PlainText fontFamily="mono" fontSize={10} letterSpacing={1.2} textTransform="uppercase" color="secondaryInk">
          {word}
        </PlainText>
      </XStack>
    </YStack>
  );
}

// One agent in line: its ticket on a tab, its face and its name.
export function LineSpot({ spot, still }: { spot: Spot; still: boolean }) {
  return (
    <YStack alignItems="center" gap={4} width={64}>
      <YStack paddingHorizontal={4} paddingVertical={2} borderWidth={1} borderColor="secondaryLine">
        <PlainText fontFamily="mono" fontSize={9} letterSpacing={1} textTransform="uppercase" color="secondaryInk">
          {spot.ticket}
        </PlainText>
      </YStack>
      <Face agentId={spot.agentId} size={20} still={still} />
      <PlainText fontFamily="mono" fontSize={10} numberOfLines={1}>
        {spot.name}
      </PlainText>
    </YStack>
  );
}

// An agent's own face in its mood now; `hop` once as it shows.
function Face({ agentId, size, hop = false, still }: { agentId: AgentId; size: number; hop?: boolean; still: boolean }) {
  const look = useAgentLook(agentId);
  return <AgentFace mood={look.mood} mascot={look.mascot} size={size} hop={hop ? 1 : 0} still={still} />;
}
