import { YStack } from 'tamagui';
import type { MemoryLevel } from '../../../../engine/memory';
import { usedPercent } from '../../logic/mapText';
import type { RamUse } from '../../logic/memoryRows';
import type { RamMap } from '../../logic/ramMap';
import Hatch from './Hatch';
import { INK, pct, ZONE_INK } from './inks';

// The strip's height, and how far the sweat line reaches past it.
const HEIGHT = 20;
const STICK = 4;

// The phone's memory as one strip on bare paper: our models and agents
// each as its own block, then everything else Android holds, then free
// paper. The zone where we start to sweat is hatched at its right, behind
// the blocks, with the line where it starts standing out above and below:
// once the blocks reach into the hatching, memory is short.
export default function RamStrip({ map, use, level }: { map: RamMap; use: RamUse; level: MemoryLevel }) {
  const line = use.warnFraction;
  return (
    <YStack paddingVertical={STICK}>
      <YStack
        height={HEIGHT}
        overflow="hidden"
        borderWidth={1}
        borderColor="lineStrong"
        backgroundColor="bg"
        accessibilityRole="progressbar"
        accessibilityLabel="Memory used"
        accessibilityValue={{ min: 0, max: 100, now: usedPercent(use) }}
      >
        {line != null ? (
          <YStack position="absolute" top={0} bottom={0} left={pct(line)} right={0}>
            <Hatch id="sweat-zone" ink={ZONE_INK[level]} />
          </YStack>
        ) : null}
        {[...map.blocks].reverse().map((b) => (
          // Each block runs from the strip's start to its own end, the last
          // drawn first and the first on top, so every boundary is one block's
          // end over the next. All share one left edge, so each end rounds to
          // pixels on its own: two edges meant to meet (one block's end, the
          // next one's start) round apart, a 1dp border putting the strip
          // between pixels, and leave a seam or a sliver.
          // On paper first, so a see-through ink (the rest's grey) hides the
          // hatching too. No line between blocks: one reads as a gap, and the
          // key and the rows below tell the agents apart.
          <YStack
            key={b.key}
            position="absolute"
            top={0}
            bottom={0}
            left={0}
            width={pct(b.start + b.width)}
            backgroundColor="bg"
          >
            <YStack flex={1} backgroundColor={INK[b.ink]} />
          </YStack>
        ))}
      </YStack>
      {line != null ? (
        <YStack position="absolute" top={0} bottom={0} left={pct(line)} width={2} marginLeft={-1} backgroundColor="fg" />
      ) : null}
    </YStack>
  );
}
