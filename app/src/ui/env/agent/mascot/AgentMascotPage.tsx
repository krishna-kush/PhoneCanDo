import { useState } from 'react';
import { ScrollView, useWindowDimensions } from 'react-native';
import { XStack } from 'tamagui';
import { SHAPES } from '../../../../../../mascot/body.ts';
import type { Look } from '../../../../../../mascot/look.ts';
import { useAppStore } from '../../../../state/app';
import { useMascotsStore } from '../../../../state/mascots';
import { useStarterStore } from '../../../../state/starter';
import { useAgentLook } from '../../../common/face/useAgentLook';
import PageHeader from '../../../common/PageHeader';
import Screen from '../../../common/Screen';
import SectionTitle from '../../../common/SectionTitle';
import { usePageActive } from '../../../nav/pageActive';
import AgentGone from '../AgentGone';
import { useAgentRecords } from '../useAgentRecords';
import { MASCOT_TITLE, SHAPE_LABEL, SHAPE_TITLE, WARDROBE_TITLE } from './copy';
import MascotChoice from './MascotChoice';
import MascotStage from './stage/MascotStage';
import { useShuffle } from './stage/useShuffle';
import Wardrobe from './wardrobe/Wardrobe';

// The page's own padding, which its scrolling part reaches past so it
// scrolls to the screen's edges.
const EDGE = 16;

// An agent's Mascot page, a fitting room: the stage stays at the top with
// the face big (stage/), and under it scroll the five shapes and the
// wardrobe, every design there is (mascot/designs.ts), each shown as it
// would look. A pick shows at once wherever its face does. An earned design
// hangs last, locked (a tap opens the first shift) until it is earned.
export default function AgentMascotPage({ agentId }: { agentId: string }) {
  const { agent } = useAgentRecords(agentId);
  const look = useAgentLook(agentId);
  const active = usePageActive();
  const push = useAppStore((s) => s.push);
  const { width } = useWindowDimensions();
  const [hop, setHop] = useState(0);
  const bump = () => setHop((n) => n + 1);
  const shuffle = useShuffle(() => {
    useMascotsStore.getState().surprise(agentId);
    bump();
  });
  if (!agent) return <AgentGone />;

  const { mascot } = look;
  const choose = (change: Partial<Look>) => {
    shuffle.stop();
    useMascotsStore.getState().setLook(agentId, { ...mascot, ...change });
    bump();
  };
  const openShift = () => {
    useStarterStore.getState().start();
    push({ name: 'starter' });
  };

  return (
    <Screen scroll={false} fabClearance={false}>
      <PageHeader kicker={`${look.serial} · ${agent.name}`} title={MASCOT_TITLE} />
      <MascotStage
        mascot={shuffle.preview ?? mascot}
        hop={hop}
        still={!active}
        onHop={bump}
        onSwap={() => choose({ swap: !mascot.swap })}
        onSurprise={shuffle.start}
      />
      <ScrollView
        style={{ flex: 1, marginHorizontal: -EDGE, marginBottom: -EDGE }}
        contentContainerStyle={{ paddingHorizontal: EDGE, paddingBottom: EDGE, gap: 12 }}
      >
        <SectionTitle>{SHAPE_TITLE}</SectionTitle>
        <XStack gap="2">
          {SHAPES.map((shape) => (
            <MascotChoice
              key={shape}
              label={SHAPE_LABEL[shape]}
              mascot={{ ...mascot, shape }}
              size={20}
              selected={shape === mascot.shape}
              still={!active}
              onSelect={() => choose({ shape })}
            />
          ))}
        </XStack>
        <SectionTitle>{WARDROBE_TITLE}</SectionTitle>
        <Wardrobe
          estimate={width - 2 * EDGE}
          mascot={mascot}
          still={!active}
          onPick={(design) => choose({ design })}
          onLocked={openShift}
        />
      </ScrollView>
    </Screen>
  );
}
