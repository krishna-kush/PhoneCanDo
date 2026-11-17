import { XStack, YStack } from 'tamagui';
import type { Look } from '../../../../../../../mascot/look.ts';
import type { Offer } from '../../../../../engine/agents/offers';
import { agentKind } from '../../../../../engine/agents/registry';
import AgentFace from '../../../../common/face/AgentFace';
import P1Flag from '../../../../common/P1Flag';
import PlainText from '../../../../common/PlainText';
import Plate from '../../../../common/Plate';
import KeyHead from '../../../../common/rows/KeyHead';
import { ROW_GUTTER } from '../../../../common/rows/place';
import { usePageActive } from '../../../../nav/pageActive';
import { offerBadges } from '../../../logic/agentChoice';
import Badge from '../../../parts/Badge';
import { ARCADE } from '../copy';
import { kindFacts } from '../logic/facts';
import FactRows from './FactRows';
import { useCheer } from './useCheer';

// The arcade's showcase, on the hard amber shadow: the picked applicant
// big in its frame (it hops and smiles as it is picked), its name under
// the P1 flag (still here: the grid's blinks) and its badges, then its
// stats, each meter filling up again for every new pick.
export default function Showcase({ offer, look }: { offer: Offer; look: Look | undefined }) {
  const active = usePageActive();
  const { hop, cheering } = useCheer(offer.id);
  const facts = kindFacts(agentKind(offer.id));
  return (
    <Plate>
      <KeyHead title={ARCADE.head} barcode="arcadeShowcase" />
      <XStack gap="3" paddingHorizontal={ROW_GUTTER} paddingTop="3" alignItems="center">
        <YStack
          width={84}
          height={84}
          borderWidth={1}
          borderColor="lineStrong"
          backgroundColor="bg"
          alignItems="center"
          justifyContent="flex-end"
          paddingBottom="2"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <AgentFace mood={cheering ? 'happy' : 'awake'} size={36} mascot={look} hop={hop} still={!active} hearts={2} />
          <YStack position="absolute" left={8} right={8} bottom={6} height={1} backgroundColor="line" />
        </YStack>
        <YStack flex={1} minWidth={0} gap="2">
          <P1Flag still />
          <PlainText fontSize={22} fontWeight="700" letterSpacing={-0.3} numberOfLines={2}>
            {offer.label}
          </PlainText>
          {offerBadges(offer).length ? (
            <XStack gap="2" flexWrap="wrap">
              {offerBadges(offer).map((b) => (
                <Badge key={b} label={b} />
              ))}
            </XStack>
          ) : null}
        </YStack>
      </XStack>
      <YStack paddingHorizontal={ROW_GUTTER} paddingVertical="3">
        <FactRows facts={facts} replay={offer.id} />
      </YStack>
    </Plate>
  );
}
