import { useState } from 'react';
import { XStack, YStack } from 'tamagui';
import { SHAPES } from '../../../../../../mascot/body.ts';
import { DESIGNS, designOf, EARNED } from '../../../../../../mascot/designs.ts';
import type { Look } from '../../../../../../mascot/look.ts';
import { useAppStore } from '../../../../state/app';
import { useMascotsStore } from '../../../../state/mascots';
import { useStarterStore } from '../../../../state/starter';
import AppButton from '../../../common/AppButton';
import AgentFace from '../../../common/face/AgentFace';
import { useAgentLook } from '../../../common/face/useAgentLook';
import PageHeader from '../../../common/PageHeader';
import PlainText from '../../../common/PlainText';
import Screen from '../../../common/Screen';
import SectionTitle from '../../../common/SectionTitle';
import { usePageActive } from '../../../nav/pageActive';
import { lockedLabel } from '../../../starter/copy';
import { isEarned } from '../../../starter/reward';
import AgentGone from '../AgentGone';
import { useAgentRecords } from '../useAgentRecords';
import { inkLabel, MASCOT_TITLE, SHAPE_LABEL, SURPRISE, wornLine } from './copy';
import MascotChoice from './MascotChoice';

// An agent's Mascot page: its face big, with the design's name and what it
// wears, then its shape, which ink is in front and every design there is
// (mascot/designs.ts), each shown as it would look; or Surprise me for one
// at random. A pick shows at once wherever its face does. An earned design
// comes last, locked (a tap opens the first shift) until it is earned.
export default function AgentMascotPage({ agentId }: { agentId: string }) {
  const { agent } = useAgentRecords(agentId);
  const look = useAgentLook(agentId);
  const active = usePageActive();
  const push = useAppStore((s) => s.push);
  const earned = useStarterStore((s) => s.shift.earned);
  const [hop, setHop] = useState(0);
  if (!agent) return <AgentGone />;

  const { mascot } = look;
  const design = designOf(mascot.design);
  const choose = (change: Partial<Look>) => {
    useMascotsStore.getState().setLook(agentId, { ...mascot, ...change });
    setHop((n) => n + 1);
  };
  const surprise = () => {
    useMascotsStore.getState().surprise(agentId);
    setHop((n) => n + 1);
  };

  return (
    <Screen>
      <PageHeader kicker={`${look.serial} · ${agent.name}`} title={MASCOT_TITLE} />
      <XStack alignItems="center" gap="3">
        <AgentFace mood={look.mood} mascot={mascot} size={56} hop={hop} still={!active} />
        <YStack flex={1} minWidth={0} gap={2}>
          <PlainText fontSize={18} fontWeight="600" numberOfLines={1}>
            {design?.name ?? ''}
          </PlainText>
          <PlainText fontSize={13} color="muted">
            {wornLine(design)}
          </PlainText>
        </YStack>
        <AppButton variant="ghost" onPress={surprise}>
          {SURPRISE}
        </AppButton>
      </XStack>

      <SectionTitle>Shape</SectionTitle>
      <XStack flexWrap="wrap" gap="2">
        {SHAPES.map((shape) => (
          <MascotChoice
            key={shape}
            label={SHAPE_LABEL[shape]}
            mascot={{ ...mascot, shape }}
            selected={shape === mascot.shape}
            onSelect={() => choose({ shape })}
          />
        ))}
      </XStack>

      <SectionTitle>In front</SectionTitle>
      <XStack flexWrap="wrap" gap="2">
        {[false, true].map((swap) => (
          <MascotChoice
            key={String(swap)}
            label={inkLabel(swap)}
            mascot={{ ...mascot, swap }}
            selected={swap === mascot.swap}
            onSelect={() => choose({ swap })}
          />
        ))}
      </XStack>

      <SectionTitle>Design</SectionTitle>
      <XStack flexWrap="wrap" gap="2">
        {DESIGNS.map((d) => (
          <MascotChoice
            key={d.id}
            label={d.name}
            mascot={{ ...mascot, design: d.id }}
            selected={d.id === mascot.design}
            onSelect={() => choose({ design: d.id })}
          />
        ))}
        {EARNED.map((d) =>
          isEarned(d.id, earned) ? (
            <MascotChoice
              key={d.id}
              label={d.name}
              mascot={{ ...mascot, design: d.id }}
              selected={d.id === mascot.design}
              onSelect={() => choose({ design: d.id })}
            />
          ) : (
            <MascotChoice
              key={d.id}
              label={lockedLabel(d.name)}
              mascot={{ ...mascot, design: d.id }}
              selected={false}
              onSelect={() => {
                useStarterStore.getState().start();
                push({ name: 'starter' });
              }}
            />
          ),
        )}
      </XStack>
    </Screen>
  );
}
