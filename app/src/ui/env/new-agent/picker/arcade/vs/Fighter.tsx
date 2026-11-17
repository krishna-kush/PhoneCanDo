import { YStack } from 'tamagui';
import type { Look } from '../../../../../../../../mascot/look.ts';
import type { Offer } from '../../../../../../engine/agents/offers';
import { agentKind } from '../../../../../../engine/agents/registry';
import BoopFace from '../../../../../common/face/BoopFace';
import PlainText from '../../../../../common/PlainText';
import { usePageActive } from '../../../../../nav/pageActive';
import { makerLine } from '../../copy';
import { useCheer } from '../useCheer';

type Props = { offer: Offer; look: Look | undefined; side: 'pick' | 'challenger' };

// One side of the VS plate: the applicant in its side's colour of frame
// (the pick red, the challenger amber; it hops and smiles as it steps in
// and hops at a tap), its name and who makes it, lined up on its own edge
// (the pick left, the challenger right).
export default function Fighter({ offer, look, side }: Props) {
  const active = usePageActive();
  const { hop, cheering } = useCheer(offer.id);
  const maker = agentKind(offer.id).about?.maker;
  const pick = side === 'pick';
  const edge = pick ? 'flex-start' : 'flex-end';
  const align = pick ? undefined : 'right';
  return (
    <YStack flex={1} minWidth={0} alignItems={edge} gap="2">
      <YStack
        width={64}
        height={64}
        borderWidth={1}
        borderColor={pick ? 'primary' : 'secondary'}
        backgroundColor="bg"
        alignItems="center"
        justifyContent="flex-end"
        paddingBottom={8}
      >
        <BoopFace
          mood={cheering ? 'happy' : 'awake'}
          size={28}
          mascot={look}
          hop={hop}
          still={!active}
          label={`${offer.label}'s face. Tap it.`}
        />
      </YStack>
      <YStack alignItems={edge}>
        <PlainText fontSize={16} fontWeight="700" numberOfLines={2} textAlign={align}>
          {offer.label}
        </PlainText>
        {maker ? (
          <PlainText fontFamily="mono" fontSize={10} color="dim" numberOfLines={1} textAlign={align}>
            {makerLine(maker)}
          </PlainText>
        ) : null}
      </YStack>
    </YStack>
  );
}
