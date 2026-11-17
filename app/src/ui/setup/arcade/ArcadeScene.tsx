import { XStack, YStack } from 'tamagui';
import P1Flag from '../../common/P1Flag';
import PlainText from '../../common/PlainText';
import Plate from '../../common/Plate';
import { overall } from '../logic/stage';
import { ARCADE } from '../copy';
import { clock } from '../logic/clock';
import type { SceneProps } from './props';
import StatusLine from './StatusLine';
import Headline from './Headline';
import TipBox from './TipBox';
import Track from './Track';
import { useElapsed } from './useElapsed';

// The arcade look, Choose agent's character select carried on: a game's
// loading screen in a cabinet on the hard amber shadow. NOW LOADING over a
// bar of four levels, one a stage, that the agent runs along (unpacking
// fills its level as it goes, the quick ones dash through theirs) to the
// flag; the player line and a running clock over it, a tip under it, a
// new one every few seconds. At the finale: STAGE CLEAR! and the agent
// jumps for joy; on a failure: CONTINUE? over Retry.
export default function ArcadeScene({ state, mascot, agentName, label }: SceneProps) {
  const running = !state.done && !state.failed;
  const elapsed = useElapsed(running);
  return (
    <YStack gap="3">
      <Plate padding="2">
        <YStack borderWidth={1} borderColor="line" backgroundColor="bg" padding="3" gap="4">
          <XStack alignItems="center" gap="2">
            <P1Flag small still={!running} />
            <PlainText fontFamily="mono" fontSize={11} color="muted" numberOfLines={1} flexShrink={1}>
              {ARCADE.player(agentName)}
            </PlainText>
            <XStack flex={1} />
            <PlainText fontFamily="mono" fontSize={11} letterSpacing={1} color="secondaryInk">
              {`${ARCADE.time.toUpperCase()} ${clock(elapsed)}`}
            </PlainText>
          </XStack>
          <Headline state={state} />
          <Track state={state} at={overall(state)} mascot={mascot} />
          <TipBox elapsed={elapsed} />
        </YStack>
      </Plate>
      <StatusLine label={label} />
    </YStack>
  );
}
