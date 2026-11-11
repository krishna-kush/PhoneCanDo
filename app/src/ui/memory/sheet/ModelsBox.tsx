import { YStack } from 'tamagui';
import type { MemoryLevel } from '../../../engine/memory';
import PlainText from '../../common/PlainText';
import SectionTitle from '../../common/SectionTitle';
import { nameList } from '../logic/memoryCopy';
import { totalBytes, type ModelRow } from '../logic/memoryRows';
import { modelLine, modelsBoxLine } from '../logic/rowText';
import StopModelButton from '../StopModelButton';

// The loaded local models, biggest first: what each takes, the agents on
// it and its Stop (which stops those agents first). While memory is tight
// the box is drawn in amber: models are usually the big eaters.
export default function ModelsBox({ rows, level }: { rows: ModelRow[]; level: MemoryLevel }) {
  if (rows.length === 0) return null;
  const tight = level !== 'ok';
  return (
    <YStack
      gap="2"
      padding="3"
      borderWidth={1}
      borderColor={tight ? 'secondaryLine' : 'line'}
      backgroundColor={tight ? 'secondarySoft' : 'panel2'}
    >
      <SectionTitle>Local models</SectionTitle>
      <PlainText fontSize={14} color="muted">
        {modelsBoxLine(level, totalBytes(rows))}
      </PlainText>
      {rows.map((row) => (
        <YStack key={row.modelId} gap="1" paddingTop="2" borderTopWidth={1} borderColor="line">
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
          <YStack marginTop="1">
            <StopModelButton modelId={row.modelId} name={row.name} agentNames={row.agentNames} />
          </YStack>
        </YStack>
      ))}
    </YStack>
  );
}
