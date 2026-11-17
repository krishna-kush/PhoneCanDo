import { XStack, YStack } from 'tamagui';
import type { Look } from '../../../../../../../../mascot/look.ts';
import type { Offer } from '../../../../../../engine/agents/offers';
import { agentKind } from '../../../../../../engine/agents/registry';
import AppButton from '../../../../../common/AppButton';
import PlainText from '../../../../../common/PlainText';
import Plate from '../../../../../common/Plate';
import KeyHead from '../../../../../common/rows/KeyHead';
import { ROW_GUTTER } from '../../../../../common/rows/place';
import Stamp from '../../../../../common/Stamp';
import { LEAVE_VS, pickInstead, verdictText, vsHead, vsScoreNote } from '../../copy';
import { vsRows, vsScore, vsVerdict } from '../../logic/vs';
import PlateRule from '../PlateRule';
import ChallengerBanner from './ChallengerBanner';
import Fighter from './Fighter';
import VsRows from './VsRows';

type Props = {
  pick: Offer;
  challenger: Offer;
  looks: Readonly<Record<string, Look>>;
  /** Makes the challenger the pick (the pick steps over to challenge it). */
  onPickChallenger: () => void;
  onLeave: () => void;
};

// VS mode's plate, in the showcase's place, both named in its strip: as it
// comes up, "here comes a new challenger!" sweeps across
// (ChallengerBanner); the pick and the challenger face each other across a
// red VS, their stats side by side below (VsRows), then the scoreboard,
// each name by its score, and the winner's stamp slammed down for each new
// match up. Pick swaps them; Leave VS brings the showcase back.
export default function VsPlate({ pick, challenger, looks, onPickChallenger, onLeave }: Props) {
  const rows = vsRows(agentKind(pick.id), agentKind(challenger.id));
  const score = vsScore(rows);
  const verdict = verdictText(vsVerdict(score), pick.label, challenger.label);
  const matchUp = `${pick.id}|${challenger.id}`;
  return (
    <Plate>
      <KeyHead title={vsHead(pick.label, challenger.label)} barcode="arcadeVs" />
      <ChallengerBanner />
      <XStack gap="2" paddingHorizontal={ROW_GUTTER} paddingTop="3" paddingBottom="3" alignItems="flex-start">
        <Fighter offer={pick} look={looks[pick.id]} side="pick" />
        <YStack paddingTop={18}>
          <PlainText fontSize={26} fontWeight="700" color="primary" letterSpacing={-1}>
            VS
          </PlainText>
        </YStack>
        <Fighter offer={challenger} look={looks[challenger.id]} side="challenger" />
      </XStack>
      <PlateRule />
      <YStack paddingHorizontal={ROW_GUTTER} paddingVertical="3">
        <VsRows rows={rows} names={[pick.label, challenger.label]} replay={matchUp} />
      </YStack>
      <PlateRule />
      <YStack gap="3" paddingHorizontal={ROW_GUTTER} paddingVertical="3">
        <XStack
          alignItems="center"
          gap="3"
          accessible
          accessibilityLabel={`Score: ${pick.label} ${score.left}, ${challenger.label} ${score.right}. ${verdict}`}
        >
          <PlainText flex={1} fontFamily="mono" fontSize={12} color="muted" textAlign="right" numberOfLines={2}>
            {pick.label}
          </PlainText>
          <PlainText fontFamily="mono" fontSize={22} fontWeight="700">
            {`${score.left} : ${score.right}`}
          </PlainText>
          <PlainText flex={1} fontFamily="mono" fontSize={12} color="muted" numberOfLines={2}>
            {challenger.label}
          </PlainText>
        </XStack>
        <XStack justifyContent="center">
          <Stamp key={matchUp} slam tone={score.right > score.left ? 'secondary' : 'primary'}>
            {verdict}
          </Stamp>
        </XStack>
        <PlainText fontSize={12} color="dim">
          {vsScoreNote(pick.label)}
        </PlainText>
        <XStack gap="2" flexWrap="wrap">
          <AppButton variant="secondary" onPress={onPickChallenger}>
            {pickInstead(challenger.label)}
          </AppButton>
          <AppButton variant="ghost" onPress={onLeave}>
            {LEAVE_VS}
          </AppButton>
        </XStack>
      </YStack>
    </Plate>
  );
}
