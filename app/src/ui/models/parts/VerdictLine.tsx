import { Text, YStack } from 'tamagui';
import type { RamCheck } from '../../../engine/models/types';
import { useTheme } from '../../common/globals';
import { needText, verdictText } from '../logic/modelText';

// A model's RAM verdict on this phone: the verdict in words (red when it
// cannot run here, amber when a chosen context passes what the phone can
// spare), then what it needs against what the phone can spare.
export default function VerdictLine({ ram }: { ram: RamCheck }) {
  const t = useTheme();
  const bad = ram.verdict === 'too_big' || ram.verdict === 'unsupported';
  const color = bad ? t.primary : ram.verdict === 'over_budget' ? t.secondaryInk : t.fg;
  const need = needText(ram);
  return (
    <YStack gap="1" accessibilityLiveRegion="polite">
      <Text fontSize={14} fontWeight="600" color={color}>
        {verdictText(ram)}
      </Text>
      {need ? (
        <Text fontSize={13} color={t.muted}>
          {need}
        </Text>
      ) : null}
    </YStack>
  );
}
