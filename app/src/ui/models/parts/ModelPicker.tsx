import type { LocalModel } from '../../../engine/models/types';
import type { BarcodeId } from '../../common/rows/barcode/lines';
import RowGroup from '../../common/rows/RowGroup';
import { modelChoices } from '../logic/choices';
import ChoiceRow from './ChoiceRow';

type Props = {
  /** Its box's title. */
  title: string;
  /** Its box's barcode line (common/rows/barcode/lines.ts). */
  barcode: BarcodeId;
  models: LocalModel[];
  /** The model picked; null: the agent's own setup. */
  selected: string | null;
  disabled?: boolean;
  onSelect: (id: string | null) => void;
};

// The Model choices as one pick-one list in a RowGroup: the agent's Model
// page and a new agent's Model step.
export default function ModelPicker({ title, barcode, models, selected, disabled = false, onSelect }: Props) {
  return (
    <RowGroup title={title} barcode={barcode} radio>
      {modelChoices(models, selected).map((c) => (
        <ChoiceRow
          key={c.id ?? 'own'}
          label={c.label}
          note={c.note}
          dates={c.dates}
          selected={c.id === selected}
          disabled={c.disabled || disabled}
          onPress={() => onSelect(c.id)}
        />
      ))}
    </RowGroup>
  );
}
