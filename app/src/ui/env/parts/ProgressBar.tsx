import { XStack, YStack } from 'tamagui';
import LogoLoader from '../../common/LogoLoader';
import PlainText from '../../common/PlainText';
import HazardTape from './HazardTape';

// A job's line: its step in words over a thin bar, or the small logo loader
// over a crawl of hazard tape while the total is unknown. Square and
// hairline like the rest. The bar is drawn to a tenth of a percent, so a
// slow one still creeps.
export default function ProgressBar({ label, fraction }: { label: string; fraction: number | null }) {
  const percent = fraction == null ? 0 : Math.round(Math.min(1, Math.max(0, fraction)) * 1000) / 10;
  return (
    <YStack gap="2">
      <XStack alignItems="center" gap="2">
        {fraction == null ? <LogoLoader size={8} /> : null}
        <PlainText fontFamily="mono" fontSize={12} color="dim" numberOfLines={1} flexShrink={1}>
          {label}
        </PlainText>
      </XStack>
      {fraction == null ? (
        <HazardTape />
      ) : (
        <YStack
          height={4}
          backgroundColor="line"
          accessibilityRole="progressbar"
          accessibilityValue={{ min: 0, max: 100, now: Math.round(percent) }}
        >
          <YStack height={4} width={`${percent}%`} backgroundColor="primary" />
        </YStack>
      )}
    </YStack>
  );
}
