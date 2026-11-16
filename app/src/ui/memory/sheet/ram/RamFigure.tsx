import { XStack, YStack } from 'tamagui';
import type { MemoryLevel } from '../../../../engine/memory';
import PlainText from '../../../common/PlainText';
import RowFrame from '../../../common/rows/RowFrame';
import RowGroup from '../../../common/rows/RowGroup';
import { mapKey, ramReadout } from '../../logic/mapText';
import { ramHint } from '../../logic/memoryCopy';
import type { RamUse } from '../../logic/memoryRows';
import type { RamMap } from '../../logic/ramMap';
import { LEVEL_INK } from './inks';
import RamKey from './RamKey';
import RamStrip from './RamStrip';

type Props = {
  use: RamUse;
  map: RamMap;
  level: MemoryLevel;
  warnBelowBytes: number;
  /** The agent the countdown would stop, by name; null with no countdown. */
  nextName: string | null;
};

// The phone's memory as a figure with its key, in one box: what is free in
// big figures with the whole and the share used beside it, the strip of
// who holds what (RamStrip) and, under a dashed rule, its key.
export default function RamFigure({ use, map, level, warnBelowBytes, nextName }: Props) {
  const r = ramReadout(use);
  return (
    <RowGroup title="Phone memory" barcode="memoryRam">
      <RowFrame>
        <YStack gap="1">
          <XStack alignItems="baseline" gap="2">
            <PlainText fontFamily="mono" fontSize={26} fontWeight="600" letterSpacing={-0.5}>
              {r.free}
            </PlainText>
            <PlainText fontFamily="mono" fontSize={12} color="dim" flex={1} numberOfLines={1}>
              {r.of}
            </PlainText>
            <PlainText fontFamily="mono" fontSize={12} color={LEVEL_INK[level]}>
              {r.used}
            </PlainText>
          </XStack>
          <RamStrip map={map} use={use} level={level} />
        </YStack>
      </RowFrame>
      <RowFrame>
        <RamKey entries={mapKey(map, nextName)} hint={ramHint(warnBelowBytes, level, use.freeBytes)} level={level} />
      </RowFrame>
    </RowGroup>
  );
}
