import { XStack, YStack } from 'tamagui';
import type { MemoryLevel } from '../../../engine/memory';
import PlainText from '../../common/PlainText';
import { ramHint, ramLine } from '../logic/memoryCopy';
import type { RamUse } from '../logic/memoryRows';

// The phone's memory as a bar: used in the level's ink, the line where we
// start to worry as a hairline mark, the free and total memory in words.
export default function RamMeter({ use, level, warnBelowBytes }: { use: RamUse; level: MemoryLevel; warnBelowBytes: number }) {
  const percent = Math.round(use.usedFraction * 1000) / 10;
  const hint = ramHint(warnBelowBytes);
  return (
    <YStack gap="1">
      <XStack justifyContent="space-between" gap="2">
        <PlainText fontFamily="mono" fontSize={12} numberOfLines={1} flexShrink={1}>
          {ramLine(use)}
        </PlainText>
        <PlainText fontFamily="mono" fontSize={12} color="dim">
          {`${Math.round(percent)}% used`}
        </PlainText>
      </XStack>
      <YStack
        height={8}
        backgroundColor="line"
        accessibilityRole="progressbar"
        accessibilityLabel="Memory used"
        accessibilityValue={{ min: 0, max: 100, now: Math.round(percent) }}
      >
        <YStack height={8} width={`${percent}%`} backgroundColor={level === 'ok' ? 'secondary' : 'primary'} />
        {use.warnFraction != null ? (
          <YStack position="absolute" top={-2} bottom={-2} left={`${use.warnFraction * 100}%`} width={1} backgroundColor="fg" />
        ) : null}
      </YStack>
      {hint ? (
        <PlainText fontFamily="mono" fontSize={11} color="dim">
          {hint}
        </PlainText>
      ) : null}
    </YStack>
  );
}
