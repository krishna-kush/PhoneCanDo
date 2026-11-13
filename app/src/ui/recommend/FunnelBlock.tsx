import { XStack, YStack } from 'tamagui';
import PlainText from '../common/PlainText';
import type { FunnelStep } from './logic/funnel';

// The funnel over every link, one row per step: its name, what it counts,
// the number, and a bar against the biggest step, so the drop from Sent to
// Installed reads at a glance.
export default function FunnelBlock({ steps }: { steps: FunnelStep[] }) {
  const top = Math.max(1, ...steps.map((s) => s.count));
  return (
    <YStack borderWidth={1} borderColor="line" backgroundColor="panel" padding="3" gap="3">
      {steps.map((s) => (
        <YStack key={s.key} gap="1" accessible accessibilityLabel={`${s.label}: ${s.count}, ${s.line}`}>
          <XStack alignItems="flex-end" gap="3">
            <YStack flex={1} minWidth={0}>
              <PlainText fontFamily="mono" fontSize={11} fontWeight="600" letterSpacing={1.4} color="dim" textTransform="uppercase">
                {s.label}
              </PlainText>
              <PlainText fontSize={13} color="muted" numberOfLines={1}>
                {s.line}
              </PlainText>
            </YStack>
            <PlainText fontFamily="mono" fontSize={22} fontWeight="700">
              {String(s.count)}
            </PlainText>
          </XStack>
          <YStack height={4} backgroundColor="line">
            <YStack height={4} width={`${Math.round((s.count / top) * 100)}%`} backgroundColor={s.key === 'installed' ? 'primary' : 'secondary'} />
          </YStack>
        </YStack>
      ))}
    </YStack>
  );
}
