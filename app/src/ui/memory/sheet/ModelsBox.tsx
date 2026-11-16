import type { MemoryLevel } from '../../../engine/memory';
import RowGroup from '../../common/rows/RowGroup';
import { totalBytes, type ModelRow } from '../logic/memoryRows';
import { modelKey, shareOf, type RamMap } from '../logic/ramMap';
import { modelsBoxLine } from '../logic/rowText';
import BoxLine from './BoxLine';
import ModelStopRow from './ModelStopRow';

type Props = {
  rows: ModelRow[];
  level: MemoryLevel;
  /** The strip's blocks, for each row's share bar; null when memory was not measured. */
  map: RamMap | null;
  /** Opens a model's page. */
  onOpen: (modelId: string) => void;
};

// The loaded local models in one box, biggest first: what to know about
// them, then each with its Stop (which stops its agents first). While
// memory is tight the line is washed amber: models are usually the big
// eaters.
export default function ModelsBox({ rows, level, map, onOpen }: Props) {
  if (rows.length === 0) return null;
  return (
    <RowGroup title="Local models">
      <BoxLine tight={level !== 'ok'}>{modelsBoxLine(level, totalBytes(rows))}</BoxLine>
      {rows.map((row) => (
        <ModelStopRow
          key={row.modelId}
          row={row}
          share={map ? shareOf(map, modelKey(row.modelId)) : 0}
          onOpen={() => onOpen(row.modelId)}
        />
      ))}
    </RowGroup>
  );
}
