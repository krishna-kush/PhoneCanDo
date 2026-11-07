import { Text, XStack, YStack } from 'tamagui';
import LogoLoader from '../../common/LogoLoader';
import { useTheme } from '../../common/globals';

// A job's line: its step in words over a thin bar, or the small logo loader
// while the total is unknown. Square and hairline like the rest.
export default function ProgressBar({ label, fraction }: { label: string; fraction: number | null }) {
  const t = useTheme();
  return (
    <YStack gap="$2">
      <XStack alignItems="center" gap="$2">
        {fraction == null ? <LogoLoader size={8} /> : null}
        <Text fontFamily="$mono" fontSize={12} color={t.dim} numberOfLines={1} flexShrink={1}>
          {label}
        </Text>
      </XStack>
      {fraction != null ? (
        <YStack
          height={4}
          backgroundColor={t.line}
          accessibilityRole="progressbar"
          accessibilityValue={{ min: 0, max: 100, now: Math.round(fraction * 100) }}
        >
          <YStack height={4} width={`${Math.round(fraction * 100)}%`} backgroundColor={t.primary} />
        </YStack>
      ) : null}
    </YStack>
  );
}
