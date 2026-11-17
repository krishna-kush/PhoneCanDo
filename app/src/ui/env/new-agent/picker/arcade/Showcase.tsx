import { useState } from 'react';
import { XStack, YStack } from 'tamagui';
import type { Look } from '../../../../../../../mascot/look.ts';
import type { Offer } from '../../../../../engine/agents/offers';
import { agentKind } from '../../../../../engine/agents/registry';
import BoopFace from '../../../../common/face/BoopFace';
import { boopLine } from '../../../../common/face/lines';
import PlainText from '../../../../common/PlainText';
import Plate from '../../../../common/Plate';
import KeyHead from '../../../../common/rows/KeyHead';
import { ROW_GUTTER } from '../../../../common/rows/place';
import { usePageActive } from '../../../../nav/pageActive';
import { offerBadges } from '../../../logic/agentChoice';
import Badge from '../../../parts/Badge';
import { ARCADE, makerLine } from '../copy';
import { kindFacts } from '../logic/facts';
import { playLinks, powerMove } from '../logic/howToPlay';
import FactRows from './FactRows';
import HowToPlay from './HowToPlay';
import PlateRule from './PlateRule';
import PowerMove from './PowerMove';
import { useCheer } from './useCheer';
import VsSticker from './vs/VsSticker';

// The arcade's showcase, on the hard amber shadow: the picked applicant
// big in its frame (it hops and smiles as it is picked, and hops at a tap
// like every face, saying something new each time), its name, who makes
// it and its badges, the VS sticker at its side when there is someone to
// challenge it, then its stats, each meter filling up again and its coin
// spinning for every new pick; under a dashed rule each, its power move
// (what to type in its own app) and How to play, its official pages, when
// its kind names them.
type Props = {
  offer: Offer;
  look: Look | undefined;
  /** Brings a challenger in (VS mode); none: nobody else to challenge it. */
  onChallenge?: () => void;
};

export default function Showcase({ offer, look, onChallenge }: Props) {
  const active = usePageActive();
  const { hop, cheering } = useCheer(offer.id);
  const [boops, setBoops] = useState({ id: offer.id, n: 0 });
  const booped = boops.id === offer.id ? boops.n : 0;
  const kind = agentKind(offer.id);
  const facts = kindFacts(kind, Date.now());
  const move = powerMove(kind.about);
  const links = playLinks(kind.about);
  const maker = kind.about?.maker;
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
        >
          <BoopFace
            mood={cheering ? 'happy' : 'awake'}
            size={36}
            mascot={look}
            hop={hop}
            still={!active}
            hearts={2}
            label={`${offer.label}'s face. Tap it.`}
            onBoop={(n) => setBoops({ id: offer.id, n })}
          />
          <YStack position="absolute" left={8} right={8} bottom={6} height={1} backgroundColor="line" />
        </YStack>
        <YStack flex={1} minWidth={0} gap="2">
          <YStack>
            <PlainText fontSize={22} fontWeight="700" letterSpacing={-0.3} numberOfLines={2}>
              {offer.label}
            </PlainText>
            {maker || booped ? (
              <PlainText fontFamily="mono" fontSize={11} color="dim" numberOfLines={1}>
                {[maker ? makerLine(maker) : '', booped ? boopLine(booped - 1) : ''].filter(Boolean).join(' · ')}
              </PlainText>
            ) : null}
          </YStack>
          {offerBadges(offer).length ? (
            <XStack gap="2" flexWrap="wrap">
              {offerBadges(offer).map((b) => (
                <Badge key={b} label={b} />
              ))}
            </XStack>
          ) : null}
        </YStack>
        {onChallenge ? <VsSticker onPress={onChallenge} /> : null}
      </XStack>
      <YStack paddingHorizontal={ROW_GUTTER} paddingVertical="3">
        <FactRows facts={facts} replay={offer.id} />
      </YStack>
      {move ? (
        <>
          <PlateRule />
          <YStack paddingHorizontal={ROW_GUTTER} paddingVertical="3">
            <PowerMove keys={move.keys} does={move.does} replay={offer.id} />
          </YStack>
        </>
      ) : null}
      {links.length ? (
        <>
          <PlateRule />
          <YStack paddingHorizontal={ROW_GUTTER} paddingVertical="3">
            <HowToPlay key={offer.id} links={links} />
          </YStack>
        </>
      ) : null}
    </Plate>
  );
}
