import { XStack, YStack } from 'tamagui';
import AppButton from '../../common/AppButton';
import PlainText from '../../common/PlainText';
import RowFrame from '../../common/rows/RowFrame';
import Note from '../../env/parts/Note';
import Cartridge from '../../settings/caps/Cartridge';
import { nameList } from '../logic/memoryCopy';
import type { ModelRow } from '../logic/memoryRows';
import { modelLine } from '../logic/rowText';
import ModelStopConfirm from '../ModelStopConfirm';
import { useModelStop } from '../useModelStop';
import ShareBar from './ram/ShareBar';

// One loaded local model in the RAM warning: its cartridge (seated once it
// answers ready, lifted while it loads), its name, what it takes, the
// agents on it, its share of the phone's memory as an amber bar, and Stop.
// With agents on it, Stop asks first across the whole row. A tap on the
// row (not its Stop) opens the model's page.
export default function ModelStopRow({ row, share, onOpen }: { row: ModelRow; share: number; onOpen: () => void }) {
  const stop = useModelStop(row.modelId, row.name, row.agentNames);
  return (
    <RowFrame
      press={{ onPress: onOpen, role: 'button', label: `${row.name}, ${modelLine(row)}`, hint: 'Opens its page' }}
    >
      <YStack gap="3">
        <XStack alignItems="center" gap="3">
          <YStack width={22} alignItems="center" accessibilityElementsHidden>
            <Cartridge lit={row.ready} />
          </YStack>
          <YStack flex={1} minWidth={0} gap={3}>
            <PlainText fontSize={16} fontWeight="600" numberOfLines={2}>
              {row.name}
            </PlainText>
            <PlainText fontFamily="mono" fontSize={11} color="dim">
              {modelLine(row)}
            </PlainText>
            {row.agentNames.length > 0 ? (
              <PlainText fontFamily="mono" fontSize={11} color="dim" numberOfLines={2}>
                {`on it: ${nameList(row.agentNames)}`}
              </PlainText>
            ) : null}
            <ShareBar share={share} ink="model" />
          </YStack>
          {stop.asking ? null : (
            <AppButton variant="secondary" loading={stop.busy} onPress={stop.press}>
              Stop
            </AppButton>
          )}
        </XStack>
        {stop.asking ? <ModelStopConfirm stop={stop} /> : null}
        {stop.error ? <Note tone="error">{stop.error}</Note> : null}
      </YStack>
    </RowFrame>
  );
}
