import { XStack, YStack } from 'tamagui';
import type { MemoryLevel } from '../../../../engine/memory';
import PlainText from '../../../common/PlainText';
import type { KeyEntry, KeyInk } from '../../logic/mapText';
import Hatch from './Hatch';
import { INK, ZONE_INK } from './inks';

const SWATCH = 10;

// The key under the strip, as a figure's key: a swatch per kind of block
// with what it is and what it takes, then the hatched zone and where we
// start to sweat.
export default function RamKey({ entries, hint, level }: { entries: KeyEntry[]; hint: string; level: MemoryLevel }) {
  return (
    <YStack gap="2">
      <XStack flexWrap="wrap" columnGap={14} rowGap={6}>
        {entries.map((e) => (
          <XStack key={`${e.ink}:${e.label}`} alignItems="center" gap={6}>
            <Swatch ink={e.ink} />
            <PlainText fontFamily="mono" fontSize={11} color="muted">
              {e.label}
            </PlainText>
            {e.bytes ? (
              <PlainText fontFamily="mono" fontSize={11} fontWeight="600">
                {e.bytes}
              </PlainText>
            ) : null}
          </XStack>
        ))}
      </XStack>
      {hint ? (
        <XStack alignItems="center" gap={6}>
          <YStack width={SWATCH} height={SWATCH} flexShrink={0} borderWidth={1} borderColor="lineStrong" overflow="hidden">
            <Hatch id="sweat-swatch" ink={ZONE_INK[level]} />
          </YStack>
          <PlainText fontFamily="mono" fontSize={11} color="dim" flex={1}>
            {hint}
          </PlainText>
        </XStack>
      ) : null}
    </YStack>
  );
}

// Free is an empty box of paper; the rest are filled in their block's ink.
function Swatch({ ink }: { ink: KeyInk }) {
  if (ink === 'free') {
    return <YStack width={SWATCH} height={SWATCH} borderWidth={1} borderColor="lineStrong" backgroundColor="bg" />;
  }
  return <YStack width={SWATCH} height={SWATCH} backgroundColor={INK[ink]} />;
}
