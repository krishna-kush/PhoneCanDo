import { YStack } from 'tamagui';
import type { RamCheck } from '../../../engine/models/types';
import { needText, verdictText } from '../logic/modelText';
import PlainText from '../../common/PlainText';

// A model's RAM verdict on this phone: the verdict in words (red when it
// cannot run here, amber when a chosen context passes what the phone can
// spare), then what it needs against what the phone can spare.
export default function VerdictLine({ ram }: { ram: RamCheck }) {
  const bad = ram.verdict === 'too_big' || ram.verdict === 'unsupported';
  const color = bad ? 'primary' : ram.verdict === 'over_budget' ? 'secondaryInk' : 'fg';
  const need = needText(ram);
  return (
    <YStack gap="1" accessibilityLiveRegion="polite">
      <PlainText fontSize={14} fontWeight="600" color={color}>
        {verdictText(ram)}
      </PlainText>
      {need ? (
        <PlainText fontSize={13} color="muted">
          {need}
        </PlainText>
      ) : null}
    </YStack>
  );
}
